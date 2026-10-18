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
      <header className="flex items-center justify-between border-b border-white/10 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-lg font-semibold text-white">Trinity</h1>
        <button onClick={alternarVoz} className="text-sm text-slate-400">
          Voz: <span className={vozLigada ? "text-cyan-300" : ""}>{vozLigada ? "ligada" : "desligada"}</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {mensagens.length === 0 && (
          <div className="space-y-2 pt-6">
            <p className="px-1 text-sm text-slate-400">Pergunta-me o que quiseres, por escrito ou por voz.</p>
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s, false)}
                className="block w-full rounded-xl border border-white/10 px-4 py-3 text-left text-sm text-slate-200"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {mensagens.map((m) => (
          <div key={m.id} className={`flex ${m.papel === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                m.papel === "user" ? "bg-cyan-500 text-slate-950" : "markdown bg-white/[0.06] text-slate-100"
              }`}
            >
              {m.papel === "user" ? m.texto : <Markdown>{m.texto}</Markdown>}
            </div>
          </div>
        ))}
        {aPensar && <div className="px-2 text-sm text-slate-500">A pensar…</div>}
        {erro && <div className="px-2 text-sm text-amber-300">{erro}</div>}
        <div ref={fundo} />
      </div>

      <form onSubmit={submeter} className="flex items-end gap-2 border-t border-white/10 p-3">
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
          placeholder="Escreve aqui…"
          className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-400"
        />
        {texto.trim() ? (
          <button disabled={aPensar} className="h-12 rounded-2xl bg-cyan-500 px-4 font-semibold text-slate-950 disabled:opacity-50">
            Enviar
          </button>
        ) : (
          <button
            type="button"
            onClick={microfone}
            disabled={aPensar && !gravador.aGravar}
            aria-label={gravador.aGravar ? "Parar e enviar" : "Falar"}
            className={`grid h-12 w-12 place-items-center rounded-full disabled:opacity-50 ${
              gravador.aGravar ? "animate-pulse bg-red-500" : "bg-cyan-500"
            }`}
          >
            {gravador.aGravar ? (
              <span className="h-4 w-4 rounded-sm bg-white" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-slate-950">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
              </svg>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
