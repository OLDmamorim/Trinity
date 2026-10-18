import { useEffect, useRef } from "react";

// Caracteres da "chuva": katakana de meia largura, dígitos e as letras de TRINITY.
const GLIFOS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789TRINITY:.=*+<>";
const TAMANHO = 16;

/** Fundo animado tipo Matrix, desenhado num canvas atrás de tudo. */
export default function ChuvaMatrix() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let gotas: number[] = [];
    let largura = 0;
    let altura = 0;

    function ajustar() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = window.innerWidth;
      altura = window.innerHeight;
      canvas!.width = largura * dpr;
      canvas!.height = altura * dpr;
      canvas!.style.width = `${largura}px`;
      canvas!.style.height = `${altura}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, largura, altura);
      const colunas = Math.ceil(largura / TAMANHO);
      gotas = Array.from({ length: colunas }, () => Math.floor((Math.random() * altura) / TAMANHO));
    }

    function passo() {
      // Escurecer um pouco o quadro anterior deixa o rasto das gotas.
      ctx!.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx!.fillRect(0, 0, largura, altura);
      ctx!.font = `${TAMANHO}px "Share Tech Mono", ui-monospace, monospace`;
      for (let i = 0; i < gotas.length; i++) {
        const c = GLIFOS[Math.floor(Math.random() * GLIFOS.length)];
        const x = i * TAMANHO;
        const y = gotas[i] * TAMANHO;
        // A cabeça da gota é quase branca; o resto fica verde pelo rasto.
        ctx!.fillStyle = Math.random() > 0.96 ? "#d6ffe0" : "#00ff41";
        ctx!.fillText(c, x, y);
        if (y > altura && Math.random() > 0.975) gotas[i] = 0;
        else gotas[i]++;
      }
    }

    ajustar();
    window.addEventListener("resize", ajustar);

    if (reduzido) {
      for (let i = 0; i < 60; i++) passo();
      return () => window.removeEventListener("resize", ajustar);
    }

    // ~20 quadros por segundo chega e poupa bateria; pára quando a app está escondida.
    let ultimo = 0;
    let pedido = 0;
    function animar(t: number) {
      pedido = requestAnimationFrame(animar);
      if (document.hidden || t - ultimo < 50) return;
      ultimo = t;
      passo();
    }
    pedido = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(pedido);
      window.removeEventListener("resize", ajustar);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-35" />;
}
