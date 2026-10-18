// Gravação de voz com o microfone (MediaRecorder), com deteção de silêncio:
// depois de falares, ao fim de alguns segundos calado a gravação termina sozinha.
import { useRef, useState } from "react";

export type OpcoesGravacao = {
  /** Chamado quando há silêncio depois de falar (falou=true) ou quando nunca chegou a falar (falou=false). */
  aoSilencio?: (falou: boolean) => void;
  silencioMs?: number;
  semFalaMs?: number;
};

type Analisador = { ctx: AudioContext; no: AnalyserNode; dados: Uint8Array<ArrayBuffer> };

export function useGravador() {
  const [aGravar, setAGravar] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);
  const fim = useRef<((b: Blob | null) => void) | null>(null);
  const analisador = useRef<Analisador | null>(null);
  const vigia = useRef<number | null>(null);
  const falouRef = useRef(false);

  /** Volume atual do microfone entre 0 e 1 (0 quando não está a gravar). */
  function nivel(): number {
    const a = analisador.current;
    if (!a) return 0;
    a.no.getByteTimeDomainData(a.dados);
    let soma = 0;
    for (const v of a.dados) soma += ((v - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(soma / a.dados.length) * 4);
  }

  function pararVigia() {
    if (vigia.current !== null) clearInterval(vigia.current);
    vigia.current = null;
  }

  async function comecar(opcoes: OpcoesGravacao = {}) {
    const { aoSilencio, silencioMs = 3000, semFalaMs = 10000 } = opcoes;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
    try {
      const ctx = new AudioContext();
      await ctx.resume(); // no Android o contexto pode nascer suspenso e o volume ficava sempre a zero
      const no = ctx.createAnalyser();
      no.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(no);
      analisador.current = { ctx, no, dados: new Uint8Array(no.fftSize) };
    } catch {
      analisador.current = null; // sem Web Audio: sem deteção de silêncio, para-se à mão
    }
    const r = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    partes.current = [];
    r.ondataavailable = (e) => e.data.size && partes.current.push(e.data);
    r.onstop = () => {
      pararVigia();
      stream.getTracks().forEach((t) => t.stop());
      analisador.current?.ctx.close().catch(() => {});
      analisador.current = null;
      const blob = partes.current.length ? new Blob(partes.current, { type: r.mimeType }) : null;
      fim.current?.(blob);
      fim.current = null;
    };
    r.start(250);
    recorder.current = r;
    falouRef.current = false;
    setAGravar(true);

    if (aoSilencio && analisador.current) {
      const inicio = performance.now();
      let ruido = 0;
      let amostras = 0;
      let ultimoSom = inicio;
      vigia.current = window.setInterval(() => {
        const agora = performance.now();
        const v = nivel();
        // Primeiro meio segundo: mede o ruído de fundo para saber o que é voz
        if (agora - inicio < 500) {
          ruido += v;
          amostras++;
          return;
        }
        const limiar = Math.max(0.12, (ruido / Math.max(1, amostras)) * 2.5);
        if (v > limiar) {
          falouRef.current = true;
          ultimoSom = agora;
        }
        if (falouRef.current && agora - ultimoSom > silencioMs) {
          pararVigia();
          aoSilencio(true);
        } else if (!falouRef.current && agora - inicio > semFalaMs) {
          pararVigia();
          aoSilencio(false);
        }
      }, 100);
    }
  }

  function parar(): Promise<Blob | null> {
    pararVigia();
    return new Promise((resolve) => {
      const r = recorder.current;
      if (!r || r.state === "inactive") return resolve(null);
      fim.current = resolve;
      r.stop();
      recorder.current = null;
      setAGravar(false);
    });
  }

  return { aGravar, comecar, parar, nivel };
}
