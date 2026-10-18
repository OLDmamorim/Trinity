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

export function verificarConfig(): string[] {
  const avisos: string[] = [];
  if (!config.palavraPasse) avisos.push("TRINITY_PASSWORD não definida: ninguém consegue entrar.");
  if (config.segredoSessao.length < 32) avisos.push("TRINITY_SESSION_SECRET em falta ou curta (mínimo 32 caracteres).");
  if (!process.env.ANTHROPIC_API_KEY) avisos.push("ANTHROPIC_API_KEY não definida: o chat não funciona.");
  if (!config.openaiKey) avisos.push("OPENAI_API_KEY não definida: a voz não funciona.");
  if (!config.poweringUrl || !config.poweringKey) avisos.push("POWERING_URL/POWERING_API_KEY em falta: sem dados do PoweringEG.");
  if (!config.vapidPublica || !config.vapidPrivada) avisos.push("Chaves VAPID em falta: sem notificações push.");
  return avisos;
}
