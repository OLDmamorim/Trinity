// Ler respostas em voz alta com a voz do próprio telemóvel (grátis, sem servidor).
// Também avisa quem estiver a ouvir (a bola) quando a Trinity começa e acaba de falar.

type Ouvinte = (aFalar: boolean) => void;
const ouvintes = new Set<Ouvinte>();
let ultimaPalavra = 0;

function avisar(aFalar: boolean) {
  ouvintes.forEach((o) => o(aFalar));
}

/** Momento (performance.now) da última palavra dita; a bola usa-o para pulsar ao ritmo da fala. */
export function momentoUltimaPalavra(): number {
  return ultimaPalavra;
}

export function aoMudarFala(o: Ouvinte): () => void {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}

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
  frase.onstart = () => avisar(true);
  frase.onboundary = () => {
    ultimaPalavra = performance.now();
  };
  frase.onend = () => avisar(false);
  frase.onerror = () => avisar(false);
  speechSynthesis.speak(frase);
}

export function calar() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  avisar(false);
}
