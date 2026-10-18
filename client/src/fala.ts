// Ler respostas em voz alta com a voz do próprio telemóvel (grátis, sem servidor).

function limparMarkdown(texto: string): string {
  return texto
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_#>`]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-•]\s+/gm, "")
    .trim();
}

function escolherVoz(): SpeechSynthesisVoice | undefined {
  const vozes = speechSynthesis.getVoices();
  return vozes.find((v) => v.lang === "pt-PT") ?? vozes.find((v) => v.lang.startsWith("pt"));
}

export function falar(texto: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const frase = new SpeechSynthesisUtterance(limparMarkdown(texto));
  frase.lang = "pt-PT";
  const voz = escolherVoz();
  if (voz) frase.voice = voz;
  speechSynthesis.speak(frase);
}

export function calar() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}
