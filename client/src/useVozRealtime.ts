// Ligação de voz bidirecional OpenAI Realtime via WebRTC.
// As ferramentas continuam a ser executadas no servidor Trinity, nunca no browser.
import { useRef, useState } from "react";
import { api } from "./api";

type Estado = "desligado" | "ligar" | "ligado";
type Evento = { type: string; name?: string; call_id?: string; arguments?: string };

export function useVozRealtime(aoErro: (e: unknown) => void) {
  const [estado, setEstado] = useState<Estado>("desligado");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const canalRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activoRef = useRef(false);

  function desligar() {
    activoRef.current = false;
    canalRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.srcObject = null;
    canalRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
    audioRef.current = null;
    setEstado("desligado");
  }

  async function ligar() {
    if (activoRef.current) return;
    activoRef.current = true;
    setEstado("ligar");
    try {
      const { client_secret } = await api.sessaoRealtime();
      if (!client_secret) throw new Error("Não foi possível iniciar a sessão Realtime.");
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (ev) => { audio.srcObject = ev.streams[0]; void audio.play().catch(() => {}); };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const canal = pc.createDataChannel("oai-events");
      canalRef.current = canal;
      canal.onmessage = async (mensagem) => {
        let ev: Evento;
        try { ev = JSON.parse(mensagem.data) as Evento; } catch { return; }
        if (ev.type !== "response.function_call_arguments.done" || ev.name !== "consultar_trinity" || !ev.call_id) return;
        try {
          const args = JSON.parse(ev.arguments || "{}") as { pergunta?: string };
          const resposta = await api.enviar(String(args.pergunta || ""), true);
          if (!activoRef.current || canal.readyState !== "open") return;
          canal.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: ev.call_id, output: resposta.resposta } }));
          canal.send(JSON.stringify({ type: "response.create" }));
        } catch (e) {
          if (activoRef.current && canal.readyState === "open") {
            canal.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: ev.call_id, output: "Erro ao consultar a Trinity." } }));
            canal.send(JSON.stringify({ type: "response.create" }));
          }
          aoErro(e);
        }
      };
      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      const resposta = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${client_secret}`, "Content-Type": "application/sdp" },
        body: oferta.sdp,
      });
      if (!resposta.ok) throw new Error(`Não foi possível ligar a voz em tempo real (${resposta.status}).`);
      await pc.setRemoteDescription({ type: "answer", sdp: await resposta.text() });
      if (!activoRef.current) { desligar(); return; }
      setEstado("ligado");
    } catch (e) {
      desligar();
      aoErro(e);
    }
  }
  return { estado, ligar, desligar };
}
