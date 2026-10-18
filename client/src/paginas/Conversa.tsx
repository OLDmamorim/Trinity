import { useEffect, useRef, useState, type FormEvent } from "react";
import Markdown from "react-markdown";
import { api, type Mensagem } from "../api";
import { useGravador } from "../gravador";
import { calar, falar } from "../fala";

const SUGESTOES = ["O que devo fazer primeiro hoje?", "Que lojas estão há mais tempo sem visita?", "Quais os pendentes mais antigos?"];

export default function Conversa({ aoErro }: { aoErro: (e: unknown) => void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [aPensar, setAPensar] = useState(false);
  const [erro, setErro] = useState("");
  const [vozLigada, setVozLigada] = useState(() => {
    try {
      return localStorage.getItem("trinity-voz") !== "0";
    } catch {
      return true;
    }
  });
  const gravador = useGravador();
  const fundo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .conversa()
      .then((r) => setMensagens(r.mensagens))
      .catch(aoErro);
  }, []);

  useEffect(() => {
    fundo.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, aPensar]);

  function alternarVoz() {
    const novo = !vozLigada;
    setVozLigada(novo);
    if (!novo) calar();
    try {
      localStorage.setItem("trinity-voz", novo ? "1" : "0");
    } catch {
      /* sem armazenamento local */
    }
  }

  async function enviar(conteudo: string, porVoz: boolean) {
    const limpo = conteudo.trim();
    if (!limpo || aPensar) return;
    setErro("");
    setTexto("");
    const temp: Mensagem = { id: -Date.now(), papel: "user", texto: limpo, por_voz: porVoz ? 1 : 0, criado_em: "" };
    setMensagens((m) => [...m, temp]);
    setAPensar(true);
    try {
      const { resposta } = await api.enviar(limpo, porVoz);
      setMensagens((m) => [...m, { id: Date.now(), papel: "assistant", texto: resposta, por_voz: 0, criado_em: "" }]);
      if (porVoz && vozLigada) falar(resposta);
    } catch (e) {
      aoErro(e);
      setErro(e instanceof Error ? e.message : "Não consegui responder.");
    } finally {
      setAPensar(false);
    }
  }

  function submeter(e: FormEvent) {
    e.preventDefault();
    enviar(texto, false);
  }

  async function microfone() {
    setErro("");
    if (!gravador.aGravar) {
      calar();
      try {
        await gravador.comecar();
      } catch {
        setErro("Não consegui usar o microfone. Verifica a permissão no Chrome.");
      }
      return;
    }
    const audio = await gravador.parar();
    if (!audio) return;
    setAPensar(true);
    try {
      const { texto: transcrito } = await api.transcrever(audio);
      setAPensar(false);
      if (transcrito) await enviar(transcrito, true);
      else setErro("Não percebi o que disseste. Tenta outra vez.");
    } catch (e) {
      aoErro(e);
      setAPensar(false);
      setErro(e instanceof Error ? e.message : "A transcrição falhou.");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-matrix/30 bg-black/70 backdrop-blur px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="falha text-lg uppercase tracking-[0.35em] text-matrix brilho">Trinity</h1>
        <button onClick={alternarVoz} className="text-xs uppercase tracking-[0.15em] text-matrix-escuro">
          Voz: <span className={vozLigada ? "text-matrix brilho" : ""}>{vozLigada ? "ligada" : "desligada"}</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {mensagens.length === 0 && (
          <div className="space-y-2 pt-6">
            <p className="cursor px-1 text-sm text-matrix-escuro">Pergunta-me o que quiseres, por escrito ou por voz</p>
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s, false)}
                className="painel block w-full rounded-md px-4 py-3 text-left text-sm text-matrix-claro"
              >
                &gt; {s}
              </button>
            ))}
          </div>
        )}
        {mensagens.map((m) => (
          <div key={m.id} className={`flex ${m.papel === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-md px-4 py-2.5 text-[15px] leading-relaxed ${
                m.papel === "user"
                  ? "border border-matrix/60 bg-matrix/15 text-matrix-claro shadow-[0_0_12px_rgba(0,255,65,0.25)]"
                  : "markdown painel text-matrix-claro"
              }`}
            >
              {m.papel === "user" ? m.texto : <Markdown>{m.texto}</Markdown>}
            </div>
          </div>
        ))}
        {aPensar && <div className="cursor px-2 text-sm uppercase tracking-[0.2em] text-matrix">A processar</div>}
        {erro && <div className="px-2 text-sm text-amber-300">{erro}</div>}
        <div ref={fundo} />
      </div>

      <form onSubmit={submeter} className="flex items-end gap-2 border-t border-matrix/30 bg-black/75 p-3 backdrop-blur">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar(texto, false);
            }
          }}
          rows={1}
          placeholder="> escreve aqui"
          className="max-h-32 min-h-12 flex-1 resize-none rounded-md border border-matrix/30 bg-black/70 px-4 py-3 text-matrix-claro placeholder:text-matrix-escuro outline-none focus:border-matrix focus:shadow-[0_0_12px_rgba(0,255,65,0.4)]"
        />
        {texto.trim() ? (
          <button disabled={aPensar} className="botao-matrix h-12 rounded-md px-4 text-sm disabled:opacity-40">
            Enviar
          </button>
        ) : (
          <button
            type="button"
            onClick={microfone}
            disabled={aPensar && !gravador.aGravar}
            aria-label={gravador.aGravar ? "Parar e enviar" : "Falar"}
            className={`grid h-12 w-12 place-items-center rounded-full disabled:opacity-50 ${
              gravador.aGravar ? "animate-pulse bg-red-500 shadow-[0_0_20px_rgba(255,0,60,0.7)]" : "botao-matrix"
            }`}
          >
            {gravador.aGravar ? (
              <span className="h-4 w-4 rounded-sm bg-white" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-matrix">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
              </svg>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
