import { useEffect, useRef, useState, type FormEvent } from "react";
import Markdown from "react-markdown";
import { api, type Mensagem } from "../api";
import { useGravador } from "../gravador";
import { calar, falar } from "../fala";
import Orbe, { type EstadoOrbe } from "../Orbe";
import { useFalando } from "../useFalando";

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
  const falando = useFalando();
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

  const estadoOrbe: EstadoOrbe = gravador.aGravar ? "ouvir" : aPensar ? "pensar" : falando ? "falar" : "repouso";
  const legenda = { ouvir: "A ouvir…", pensar: "A pensar…", falar: "", repouso: "" }[estadoOrbe];
  const vazia = mensagens.length === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-6 pb-1 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-xs tracking-[0.4em] text-suave">TRINITY</h1>
        <button onClick={alternarVoz} aria-label={vozLigada ? "Desligar a voz" : "Ligar a voz"} className="p-2 text-suave">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            {vozLigada ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6m0-6-5 6" />}
          </svg>
        </button>
      </header>

      <div className={`flex shrink-0 flex-col items-center transition-all duration-500 ${vazia ? "flex-1 justify-center" : ""}`}>
        <button
          onClick={() => (falando ? calar() : undefined)}
          aria-label={falando ? "Parar de falar" : "Trinity"}
          className={vazia ? "h-72 w-72" : "h-44 w-44"}
        >
          <Orbe estado={estadoOrbe} nivelMic={gravador.nivel} className="h-full w-full" />
        </button>
        <p className="h-5 text-xs tracking-[0.2em] text-suave">{legenda}</p>
        {vazia && (
          <div className="mt-8 flex flex-col items-center gap-3 px-6">
            {SUGESTOES.map((s) => (
              <button key={s} onClick={() => enviar(s, false)} className="text-sm text-suave active:text-texto">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {!vazia && (
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {mensagens.map((m) =>
            m.papel === "user" ? (
              <p key={m.id} className="ml-auto max-w-[85%] text-right text-[15px] text-suave">
                {m.texto}
              </p>
            ) : (
              <div key={m.id} className="markdown max-w-[95%] text-[15px] leading-7 text-texto/90">
                <Markdown>{m.texto}</Markdown>
              </div>
            ),
          )}
          {erro && <p className="text-sm text-amber-300">{erro}</p>}
          <div ref={fundo} />
        </div>
      )}
      {vazia && erro && <p className="px-6 pb-2 text-center text-sm text-amber-300">{erro}</p>}

      <form onSubmit={submeter} className="flex items-end gap-3 px-4 pb-2 pt-2">
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
          placeholder="Escreve ou fala"
          className="max-h-32 min-h-12 flex-1 resize-none rounded-3xl border border-linha bg-white/[0.03] px-5 py-3 text-texto placeholder:text-suave outline-none focus:border-destaque/50"
        />
        {texto.trim() ? (
          <button disabled={aPensar} aria-label="Enviar" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-destaque text-black disabled:opacity-30">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={microfone}
            disabled={aPensar && !gravador.aGravar}
            aria-label={gravador.aGravar ? "Parar e enviar" : "Falar"}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-30 ${
              gravador.aGravar ? "bg-red-500 text-white" : "bg-destaque text-black"
            }`}
          >
            {gravador.aGravar ? (
              <span className="h-4 w-4 rounded-sm bg-white" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
              </svg>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
