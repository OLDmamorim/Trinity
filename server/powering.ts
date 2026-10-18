// Cliente da API externa do PoweringEG (só leitura, chave no header X-API-Key).
import { config } from "./config.js";

export class PoweringIndisponivel extends Error {}

async function pedir(caminho: string, params: Record<string, string | number | undefined> = {}): Promise<unknown> {
  if (!config.poweringUrl || !config.poweringKey) {
    throw new PoweringIndisponivel("A ligação ao PoweringEG ainda não está configurada.");
  }
  const url = new URL(`${config.poweringUrl}/api/external${caminho}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));

  const resp = await fetch(url, {
    headers: { "X-API-Key": config.poweringKey, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    throw new PoweringIndisponivel(`PoweringEG respondeu ${resp.status}: ${corpo.slice(0, 200)}`);
  }
  return resp.json();
}

/** Resumo pessoal do gestor: lojas, pendentes, tarefas, alertas, visitas, reuniões, lembretes, diário. */
export function obterResumo(dias = 14) {
  return pedir("/assistente/resumo", { dias });
}

/** Resultados mensais (endpoint já existente). */
export function obterResultados(mes?: number, ano?: number, lojaId?: number) {
  return pedir(lojaId ? `/resultados/${lojaId}` : "/resultados", { mes, ano });
}

/** NPS (endpoint já existente). */
export function obterNps(mes?: number, ano?: number, lojaId?: number) {
  return pedir("/nps", { mes, ano, lojaId });
}
