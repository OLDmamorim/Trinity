import crypto from "node:crypto";

// Configuração lida das variáveis de ambiente (ver .env.example).

function opcional(nome: string, omissao = ""): string {
  return process.env[nome]?.trim() || omissao;
}

export const config = {
  porta: Number(opcional("PORT", "3000")),
  producao: process.env.NODE_ENV === "production",

  // Acesso à app: palavra-passe única do Marco e segredo para assinar a sessão.
  palavraPasse: opcional("TRINITY_PASSWORD"),
  segredoSessao: opcional("TRINITY_SESSION_SECRET"),

  // Pasta onde fica a base de dados SQLite (num volume do Railway).
  pastaDados: opcional("DATA_DIR", "./dados"),

  // Claude
  modelo: opcional("TRINITY_MODEL", "claude-opus-5-5"),
  esforco: opcional("TRINITY_EFFORT", "medium") as "low" | "medium" | "high",

  // Transcrição de voz (OpenAI)
  openaiKey: opcional("OPENAI_API_KEY"),

  // PoweringEG (API externa, só leitura)
  poweringUrl: opcional("POWERING_URL").replace(/\/+$/, ""),
  poweringKey: opcional("POWERING_API_KEY"),

  // Briefing diário: expressão cron, hora de Lisboa. Por omissão, 8h de segunda a sexta.
  briefingCron: opcional("BRIEFING_CRON", "0 8 * * 1-5"),
  fusoHorario: "Europe/Lisbon",

  // Notificações push (gerar com `npm run gerar-vapid`)
  vapidPublica: opcional("VAPID_PUBLIC_KEY"),
  vapidPrivada: opcional("VAPID_PRIVATE_KEY"),
  vapidContacto: opcional("VAPID_CONTACT", "mailto:trinity@example.com"),
};

/**
 * O segredo da sessão e as chaves das notificações não precisam de ser configurados:
 * se não vierem nas variáveis, a app gera-os uma vez e guarda-os na base de dados.
 */
export function completarSegredos(segredo: (nome: string, gerar: () => string) => string, gerarVapid: () => { publicKey: string; privateKey: string }) {
  if (config.segredoSessao.length < 32) {
    config.segredoSessao = segredo("sessao", () => crypto.randomBytes(32).toString("hex"));
  }
  if (!config.vapidPublica || !config.vapidPrivada) {
    const par = JSON.parse(segredo("vapid", () => JSON.stringify(gerarVapid()))) as { publicKey: string; privateKey: string };
    config.vapidPublica = par.publicKey;
    config.vapidPrivada = par.privateKey;
  }
}

export function verificarConfig(): string[] {
  const avisos: string[] = [];
  if (!config.palavraPasse) avisos.push("TRINITY_PASSWORD não definida: ninguém consegue entrar.");
  if (!process.env.ANTHROPIC_API_KEY) avisos.push("ANTHROPIC_API_KEY não definida: o chat não funciona.");
  if (!config.openaiKey) avisos.push("OPENAI_API_KEY não definida: a voz não funciona.");
  if (!config.poweringUrl || !config.poweringKey) avisos.push("POWERING_URL/POWERING_API_KEY em falta: sem dados do PoweringEG.");
  return avisos;
}
