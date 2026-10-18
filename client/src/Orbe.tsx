// A bola da Trinity: uma esfera de partículas que respira em repouso, segue o volume
// do microfone quando ouve, gira depressa quando pensa e pulsa quando fala.
import { useEffect, useRef } from "react";
import { momentoUltimaPalavra } from "./fala";

export type EstadoOrbe = "repouso" | "ouvir" | "pensar" | "falar";

const PONTOS = 900;
const COR = [56, 245, 170] as const; // verde-menta, a cor de destaque da app

// Pontos distribuídos por igual numa esfera (espiral de Fibonacci).
const esfera = Array.from({ length: PONTOS }, (_, i) => {
  const y = 1 - (i / (PONTOS - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const a = i * Math.PI * (3 - Math.sqrt(5));
  return { x: Math.cos(a) * r, y, z: Math.sin(a) * r, fase: Math.random() * Math.PI * 2 };
});

export default function Orbe({
  estado,
  nivelMic,
  className = "",
}: {
  estado: EstadoOrbe;
  nivelMic?: () => number;
  className?: string;
}) {
  const tela = useRef<HTMLCanvasElement>(null);
  const estadoRef = useRef(estado);
  const micRef = useRef(nivelMic);
  estadoRef.current = estado;
  micRef.current = nivelMic;

  useEffect(() => {
    const canvas = tela.current!;
    const ctx = canvas.getContext("2d")!;
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let energia = 0.1;
    let rotacao = 0;
    let anterior = performance.now();
    let pedido = 0;

    function medir() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    }
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(canvas);

    function alvo(t: number): { e: number; v: number } {
      switch (estadoRef.current) {
        case "ouvir":
          return { e: 0.15 + (micRef.current?.() ?? 0.3) * 0.9, v: 0.5 };
        case "pensar":
          return { e: 0.3 + 0.08 * Math.sin(t * 6), v: 2.2 };
        case "falar": {
          // Pulsa a cada palavra; sem eventos de palavra, simula uma cadência de fala.
          const desde = (performance.now() - momentoUltimaPalavra()) / 1000;
          const palavra = desde < 1 ? Math.exp(-desde * 7) : 0;
          const ritmo = Math.abs(Math.sin(t * 9) * Math.sin(t * 3.7));
          return { e: 0.25 + Math.max(palavra * 0.6, ritmo * 0.45), v: 0.8 };
        }
        default:
          return { e: 0.08 + 0.04 * Math.sin(t * 1.4), v: 0.25 };
      }
    }

    function desenhar(agora: number) {
      const dt = Math.min(0.05, (agora - anterior) / 1000);
      anterior = agora;
      const t = agora / 1000;
      const { e, v } = alvo(t);
      energia += (e - energia) * Math.min(1, dt * 10);
      rotacao += v * dt;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.3;
      ctx.clearRect(0, 0, w, h);

      // Brilho de fundo, mais forte com mais energia
      const brilho = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.9);
      brilho.addColorStop(0, `rgba(${COR}, ${0.16 + energia * 0.35})`);
      brilho.addColorStop(0.5, `rgba(${COR}, ${0.05 + energia * 0.1})`);
      brilho.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = brilho;
      ctx.fillRect(0, 0, w, h);

      // Anéis finos inclinados
      ctx.lineWidth = Math.max(1, w / 500);
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${COR}, ${0.12 + energia * 0.2})`;
        ctx.ellipse(cx, cy, R * (1.35 + k * 0.18 + energia * 0.1), R * (0.32 + k * 0.08), rotacao * (k ? -0.6 : 0.4) + k, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Esfera de partículas
      const cosY = Math.cos(rotacao);
      const sinY = Math.sin(rotacao);
      const incl = 0.35;
      const cosX = Math.cos(incl);
      const sinX = Math.sin(incl);
      const tamanho = Math.max(1, w / 260);
      for (const p of esfera) {
        const onda = Math.sin(p.fase + t * 3 + p.y * 4) * 0.5 + Math.sin(p.fase * 2 - t * 5) * 0.5;
        const raio = R * (1 + energia * 0.22 * onda);
        let x = p.x * cosY - p.z * sinY;
        let z = p.x * sinY + p.z * cosY;
        let y = p.y * cosX - z * sinX;
        z = p.y * sinX + z * cosX;
        const persp = 2.6 / (2.6 + z);
        x = cx + x * raio * persp;
        y = cy + y * raio * persp;
        const prof = (1 - z) / 2; // 1 = à frente
        ctx.fillStyle = `rgba(${COR}, ${0.15 + prof * 0.75})`;
        const s = tamanho * (0.6 + prof * 0.8);
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }

      // Núcleo
      const nucleo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (0.5 + energia * 0.4));
      nucleo.addColorStop(0, `rgba(220, 255, 240, ${0.35 + energia * 0.5})`);
      nucleo.addColorStop(0.4, `rgba(${COR}, ${0.15 + energia * 0.3})`);
      nucleo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = nucleo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.2, 0, Math.PI * 2);
      ctx.fill();

      if (!calmo || estadoRef.current !== "repouso") pedido = requestAnimationFrame(desenhar);
      else pedido = window.setTimeout(() => requestAnimationFrame(desenhar), 500) as unknown as number;
    }

    function aoMudarVisibilidade() {
      cancelAnimationFrame(pedido);
      if (!document.hidden) {
        anterior = performance.now();
        pedido = requestAnimationFrame(desenhar);
      }
    }
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    pedido = requestAnimationFrame(desenhar);
    return () => {
      cancelAnimationFrame(pedido);
      clearTimeout(pedido);
      obs.disconnect();
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, []);

  return <canvas ref={tela} className={className} aria-hidden="true" />;
}
