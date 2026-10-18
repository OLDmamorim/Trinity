// Gravação de voz com o microfone (MediaRecorder).
import { useRef, useState } from "react";

export function useGravador() {
  const [aGravar, setAGravar] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);
  const fim = useRef<((b: Blob | null) => void) | null>(null);

  async function comecar() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    partes.current = [];
    r.ondataavailable = (e) => e.data.size && partes.current.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
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

  return { aGravar, comecar, parar };
}
