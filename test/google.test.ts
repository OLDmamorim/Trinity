import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

process.env.GOOGLE_CLIENT_ID = "cliente-teste";
process.env.GOOGLE_CLIENT_SECRET = "segredo-teste";
process.env.TRINITY_URL = "https://trinity.exemplo.pt";

const { abrirDb, fecharDb, definirSegredo } = await import("../server/db.js");
const google = await import("../server/google.js");

beforeAll(() => {
  abrirDb(":memory:");
});
afterAll(() => fecharDb());
afterEach(() => vi.unstubAllGlobals());

function resposta(dados: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => dados } as Response;
}

describe("google calendar", () => {
  it("calcula o desvio de Lisboa no verão e no inverno", () => {
    expect(google.desvioLisboa("2026-07-15")).toBe("+01:00");
    expect(google.desvioLisboa("2026-12-15")).toBe("+00:00");
  });

  it("fim por omissão: 1 hora depois, ou o dia seguinte se for de dia inteiro", () => {
    expect(google.fimPorOmissao("2026-10-20T10:30")).toBe("2026-10-20T11:30");
    expect(google.fimPorOmissao("2026-10-20T23:30")).toBe("2026-10-21T00:30");
    expect(google.fimPorOmissao("2026-10-20")).toBe("2026-10-21");
  });

  it("monta o endereço de autorização com acesso offline e o regresso certo", () => {
    const url = new URL(google.urlAutorizacao("abc"));
    expect(url.searchParams.get("redirect_uri")).toBe("https://trinity.exemplo.pt/api/google/retorno");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("abc");
  });

  it("sem ligação, a agenda diz como ligar", async () => {
    expect(google.googleLigado()).toBe(false);
    await expect(google.agenda("2026-10-20", "2026-10-20")).rejects.toBeInstanceOf(google.GoogleDesligado);
  });

  it("junta os eventos de todos os calendários, por ordem, e cria eventos com hora de Lisboa", async () => {
    definirSegredo("google_refresh_token", "refresh-teste");
    const pedidos: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        pedidos.push({ url, init });
        if (url.includes("oauth2.googleapis.com/token")) return resposta({ access_token: "tok", expires_in: 3600 });
        if (url.includes("/users/me/calendarList"))
          return resposta({
            items: [
              { id: "marco@gmail.com", summary: "marco@gmail.com", primary: true, accessRole: "owner" },
              { id: "familia", summary: "Família", accessRole: "writer" },
              { id: "escondido", summary: "Antigo", hidden: true, accessRole: "owner" },
            ],
          });
        if (url.includes("/calendars/marco%40gmail.com/events?"))
          return resposta({ items: [{ summary: "Reunião", start: { dateTime: "2026-10-20T10:00:00+01:00" }, end: { dateTime: "2026-10-20T11:00:00+01:00" } }] });
        if (url.includes("/calendars/familia/events?"))
          return resposta({ items: [{ summary: "Jantar", start: { dateTime: "2026-10-20T20:00:00+01:00" } }, { summary: "Cancelado", status: "cancelled", start: { date: "2026-10-20" } }] });
        if (url.includes("/calendars/familia/events") && init?.method === "POST") return resposta({ id: "novo", htmlLink: "https://calendar/novo" });
        return resposta({ error: { message: "inesperado" } }, false);
      }),
    );

    const r = await google.agenda("2026-10-20", "2026-10-20");
    expect(r.calendarios).toEqual(["Principal", "Família"]);
    expect(r.eventos.map((e) => e.titulo)).toEqual(["Reunião", "Jantar"]);
    expect(pedidos.find((p) => p.url.includes("marco%40gmail.com/events"))!.url).toContain(encodeURIComponent("2026-10-20T00:00:00+01:00"));

    const criado = await google.criarEvento({ titulo: "Visita Braga", inicio: "2026-10-21T09:00", calendario: "família" });
    expect(criado).toMatchObject({ criado: true, calendario: "Família", fim: "2026-10-21T10:00" });
    const corpo = JSON.parse(String(pedidos.at(-1)!.init!.body));
    expect(corpo.start).toEqual({ dateTime: "2026-10-21T09:00:00", timeZone: "Europe/Lisbon" });
  });
});
