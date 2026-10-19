// Transcrição de notas de voz com a API da OpenAI (whisper-1, a mesma que o PoweringEG usa).
import { config } from "./config.js";

export async function transcrever(audio: Buffer, tipo: string, nomeFicheiro = "voz.webm"): Promise<string> {
  if (!config.openaiKey) throw new Error("A voz ainda não está configurada (falta OPENAI_API_KEY).");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: tipo || "audio/webm" }), nomeFicheiro);
  form.append("model", "whisper-1");
  form.append("language", "pt");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.openaiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    throw new Error(`A transcrição falhou (${resp.status}): ${corpo.slice(0, 200)}`);
  }
  const dados = (await resp.json()) as { text?: string };
  return (dados.text ?? "").trim();
}

// Voz da Trinity: texto para fala com a OpenAI (gpt-4o-mini-tts), mais natural do que a voz do telemóvel.
const INSTRUCOES_VOZ =
  "Fala português de Portugal (europeu, de Lisboa), nunca do Brasil. Tom caloroso, descontraído e confiante, como uma assistente pessoal a conversar com alguém que conhece bem. Ritmo natural de conversa, com pausas curtas.";

export const VOZ_TRINITY = "coral";

/** Pede a fala à OpenAI e devolve a resposta em mp3, a correr (para começar a tocar antes de acabar). */
export async function sintetizar(texto: string, sinal?: AbortSignal): Promise<Response> {
  if (!config.openaiKey) throw new Error("A voz ainda não está configurada (falta OPENAI_API_KEY).");
  const resp = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: VOZ_TRINITY,
      input: texto.slice(0, 4000),
      instructions: INSTRUCOES_VOZ,
      response_format: "mp3",
    }),
    signal: sinal ?? AbortSignal.timeout(60_000),
  });
  if (!resp.ok || !resp.body) {
    const corpo = await resp.text().catch(() => "");
    throw new Error(`A fala falhou (${resp.status}): ${corpo.slice(0, 200)}`);
  }
  return resp;
}

/** Limpa o texto para ser dito: sem markdown, sem links. */
export function textoParaFalar(texto: string): string {
  return texto
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#>`]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .trim();
}
