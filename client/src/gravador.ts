// Gravação de voz com o microfone (MediaRecorder).
import { useRef, useState } from "react";

export function useGravador() {
  const [aGravar, setAGravar] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);
  const fim = useRef<((b: Blob | null) => void) | null>(null);
  const analisador = useRef<{ ctx: AudioContext; no: AnalyserNode; dados: Uint8Array<ArrayBuffer> } | null>(null);

  /** Volume atual do microfone entre 0 e 1 (0 quando não está a gravar). */
  function nivel(): number {
    const a = analisador.current;
    if (!a) return 0;
    a.no.getByteTimeDomainData(a.dados);
    let soma = 0;
    for (const v of a.dados) soma += ((v - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(soma / a.dados.length) * 4);
  }

  async function comecar() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
    try {
      const ctx = new AudioContext();
      const no = ctx.createAnalyser();
      no.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(no);
      analisador.current = { ctx, no, dados: new Uint8Array(no.fftSize) };
    } catch {
      analisador.current = null; // sem Web Audio: a bola anima sem o volume
    }
    const r = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    partes.current = [];
    r.ondataavailable = (e) => e.data.size && partes.current.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      analisador.current?.ctx.close().catch(() => {});
      analisador.current = null;
      const blob = partes.current.length ? new Blob(partes.current, { type: r.mimeType }) : null;
      fim.current?.(blob);
      fim.current = null;
    };
    r.start();
    recorder.current = r;
    setAGravar(true);
  }

  function parar(): Promise<Blob | null> {
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
