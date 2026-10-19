// Ler respostas em voz alta. Primeiro tenta a voz natural do servidor (OpenAI); se falhar,
// usa a voz do próprio telemóvel.
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

let audio: HTMLAudioElement | null = null;
let ritmo = 0;
let pedido = 0; // cada falar() novo invalida o anterior

function pararAudio() {
  window.clearInterval(ritmo);
  if (audio) {
    audio.onplaying = audio.onended = audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
}

function falarNoTelemovel(texto: string) {
  if (!("speechSynthesis" in window)) return avisar(false);
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

async function falarNatural(texto: string, meu: number): Promise<void> {
  const resp = await fetch("/api/fala", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto }),
  });
  if (!resp.ok) throw new Error(`fala ${resp.status}`);
  const { id } = (await resp.json()) as { id: string };
  if (meu !== pedido) return;
  audio ??= new Audio();
  const a = audio;
  await new Promise<void>((resolve, reject) => {
    a.onplaying = () => {
      window.clearInterval(ritmo);
      // Sem eventos de palavra no mp3: a bola pulsa a uma cadência de fala.
      ritmo = window.setInterval(() => {
        if (Math.random() < 0.75) ultimaPalavra = performance.now();
      }, 230);
    };
    a.onended = () => {
      window.clearInterval(ritmo);
      if (meu === pedido) avisar(false);
      resolve();
    };
    a.onerror = () => reject(new Error("áudio"));
    a.src = `/api/fala/${id}`;
    a.play().catch(reject);
  });
}

export function falar(texto: string) {
  const meu = ++pedido;
  pararAudio();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  avisar(true);
  falarNatural(texto, meu).catch(() => {
    if (meu !== pedido) return;
    pararAudio();
    falarNoTelemovel(texto);
  });
}

export function calar() {
  pedido++;
  pararAudio();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  avisar(false);
}
