// Google Calendar: autorização (OAuth) e leitura/criação de eventos em todos os calendários do Marco.
import { config } from "./config.js";
import * as db from "./db.js";

const FUSO = "Europe/Lisbon";
const ESCOPO = "https://www.googleapis.com/auth/calendar";
const API = "https://www.googleapis.com/calendar/v3";
const SEGREDO_REFRESH = "google_refresh_token";

export class GoogleDesligado extends Error {
  constructor() {
    super("O Google Calendar não está ligado. No separador Hoje, toca em \"Ligar Google Calendar\".");
  }
}

export function googleConfigurado(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret);
}

export function googleLigado(): boolean {
  return googleConfigurado() && Boolean(db.lerSegredo(SEGREDO_REFRESH));
}

export function urlRetorno(): string {
  return `${config.urlPublico}/api/google/retorno`;
}

export function urlAutorizacao(estado: string): string {
  const p = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: urlRetorno(),
    response_type: "code",
    scope: ESCOPO,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: estado,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

let acesso: { token: string; expira: number } | null = null;

async function pedirToken(corpo: Record<string, string>) {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.googleClientId, client_secret: config.googleClientSecret, ...corpo }),
  });
  const dados = (await resp.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };
  return { ok: resp.ok, dados };
}

/** Troca o código que o Google devolve depois de autorizar pelos tokens e guarda o de renovação. */
export async function concluirLigacao(codigo: string) {
  const { ok, dados } = await pedirToken({ code: codigo, grant_type: "authorization_code", redirect_uri: urlRetorno() });
  if (!ok || !dados.access_token) throw new Error(`O Google recusou a ligação (${dados.error ?? "sem detalhe"}).`);
  if (dados.refresh_token) db.definirSegredo(SEGREDO_REFRESH, dados.refresh_token);
  if (!db.lerSegredo(SEGREDO_REFRESH)) throw new Error("O Google não devolveu autorização permanente. Tenta ligar outra vez.");
  acesso = { token: dados.access_token, expira: Date.now() + (dados.expires_in ?? 3600) * 1000 };
}

export function desligar() {
  db.apagarSegredo(SEGREDO_REFRESH);
  acesso = null;
}

async function tokenAcesso(): Promise<string> {
  if (!googleConfigurado()) throw new GoogleDesligado();
  if (acesso && acesso.expira - 60_000 > Date.now()) return acesso.token;
  const refresh = db.lerSegredo(SEGREDO_REFRESH);
  if (!refresh) throw new GoogleDesligado();
  const { ok, dados } = await pedirToken({ refresh_token: refresh, grant_type: "refresh_token" });
  if (!ok || !dados.access_token) {
    // invalid_grant: a autorização foi revogada ou expirou; é preciso ligar de novo
    if (dados.error === "invalid_grant") desligar();
    throw dados.error === "invalid_grant" ? new GoogleDesligado() : new Error(`Falha ao renovar o acesso ao Google (${dados.error ?? "sem detalhe"}).`);
  }
  acesso = { token: dados.access_token, expira: Date.now() + (dados.expires_in ?? 3600) * 1000 };
  return acesso.token;
}

async function google<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const token = await tokenAcesso();
  const resp = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opcoes.headers ?? {}) },
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (dados as { error?: { message?: string } }).error?.message ?? `HTTP ${resp.status}`;
    throw new Error(`Google Calendar: ${msg}`);
  }
  return dados as T;
}

/** Desvio de Lisboa em relação a UTC nesse dia, no formato "+01:00". */
export function desvioLisboa(dia: string): string {
  const meioDia = new Date(`${dia}T12:00:00Z`);
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, timeZoneName: "longOffset" })
    .formatToParts(meioDia)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = nome.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return m ? `${m[1]}:${m[2] ?? "00"}` : "+00:00";
}

function somarDia(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type Calendario = { id: string; summary: string; primary?: boolean; selected?: boolean; hidden?: boolean; accessRole: string };
type EventoGoogle = {
  summary?: string;
  location?: string;
  description?: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

async function calendarios(): Promise<Calendario[]> {
  const r = await google<{ items?: Calendario[] }>("/users/me/calendarList?maxResults=250");
  return (r.items ?? []).filter((c) => !c.hidden);
}

/** Eventos de todos os calendários visíveis entre dois dias (inclusive), hora de Lisboa. */
export async function agenda(de: string, ate: string) {
  const timeMin = `${de}T00:00:00${desvioLisboa(de)}`;
  const fimExclusivo = somarDia(ate, 1);
  const timeMax = `${fimExclusivo}T00:00:00${desvioLisboa(fimExclusivo)}`;
  const lista = (await calendarios()).filter((c) => c.selected !== false);
  const porCalendario = await Promise.all(
    lista.map(async (c) => {
      const p = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "100", timeZone: FUSO });
      try {
        const r = await google<{ items?: EventoGoogle[] }>(`/calendars/${encodeURIComponent(c.id)}/events?${p}`);
        return (r.items ?? [])
          .filter((e) => e.status !== "cancelled")
          .map((e) => ({
            calendario: c.primary ? "Principal" : c.summary,
            titulo: e.summary ?? "(sem título)",
            diaInteiro: Boolean(e.start?.date),
            inicio: e.start?.dateTime ?? e.start?.date ?? null,
            fim: e.end?.dateTime ?? e.end?.date ?? null,
            local: e.location ?? null,
            descricao: e.description ? e.description.slice(0, 300) : null,
          }));
      } catch {
        return [];
      }
    }),
  );
  const eventos = porCalendario.flat().sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
  return { de, ate, calendarios: lista.map((c) => (c.primary ? "Principal" : c.summary)), eventos };
}

export type NovoEvento = {
  titulo: string;
  inicio: string; // "AAAA-MM-DD" (dia inteiro) ou "AAAA-MM-DDTHH:MM" (hora de Lisboa)
  fim?: string;
  local?: string;
  descricao?: string;
  calendario?: string; // nome de um calendário onde o Marco pode escrever; por omissão o principal
};

/** Fim por omissão: 1 hora depois (ou o próprio dia, se for de dia inteiro). */
export function fimPorOmissao(inicio: string): string {
  if (!inicio.includes("T")) return somarDia(inicio, 1);
  const [dia, hora] = inicio.split("T");
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + 60;
  if (total >= 24 * 60) return `${somarDia(dia, 1)}T${String(Math.floor((total - 1440) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  return `${dia}T${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export async function criarEvento(ev: NovoEvento) {
  let calendarioId = "primary";
  let nomeCalendario = "Principal";
  if (ev.calendario) {
    const alvo = (await calendarios()).find(
      (c) => c.summary.toLowerCase() === ev.calendario!.toLowerCase() && ["owner", "writer"].includes(c.accessRole),
    );
    if (!alvo) throw new Error(`Não encontrei um calendário "${ev.calendario}" onde possa escrever.`);
    calendarioId = alvo.id;
    nomeCalendario = alvo.primary ? "Principal" : alvo.summary;
  }
  const diaInteiro = !ev.inicio.includes("T");
  const fim = ev.fim ?? fimPorOmissao(ev.inicio);
  const ponto = (v: string) => (diaInteiro ? { date: v } : { dateTime: `${v.length === 16 ? `${v}:00` : v}`, timeZone: FUSO });
  const criado = await google<{ htmlLink?: string; id: string }>(`/calendars/${encodeURIComponent(calendarioId)}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: ev.titulo,
      location: ev.local,
      description: ev.descricao,
      start: ponto(ev.inicio),
      end: ponto(fim),
    }),
  });
  return { criado: true, calendario: nomeCalendario, titulo: ev.titulo, inicio: ev.inicio, fim, link: criado.htmlLink ?? null };
}
