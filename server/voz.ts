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
