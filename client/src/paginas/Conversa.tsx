// Ecrã principal: só a bola, em conversa por voz. A conversa escrita e o "O meu dia"
// ficam num menu que se abre no canto.
import { useEffect, useRef, useState, type FormEvent } from "react";
import Texto from "../Texto";
import { api, type Mensagem } from "../api";
import { useGravador } from "../gravador";
import { calar, falar } from "../fala";
import Orbe, { type EstadoOrbe } from "../Orbe";
import { useFalando } from "../useFalando";
import Hoje from "./Hoje";

type Separador = "conversa" | "hoje";

function linkWhatsApp(texto: string): string | null {
  return texto.match(/\((https:\/\/wa\.me\/[^)\s]+)\)/)?.[1] ?? null;
}

export default function Conversa({ aoErro }: { aoErro: (e: unknown) => void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [aPensar, setAPensar] = useState(false);
  const [erro, setErro] = useState("");
  const [menu, setMenu] = useState<Separador | null>(null);
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

  // Modo conversa por voz: fala-se, ao fim de 3 segundos calado ela responde em voz alta
  // e volta a ouvir, até se tocar na bola para parar.
  const [modoVoz, setModoVoz] = useState(false);
  const modoVozRef = useRef(false);
  const vozLigadaRef = useRef(vozLigada);
  vozLigadaRef.current = vozLigada;

  useEffect(() => {
    api
      .conversa()
      .then((r) => setMensagens(r.mensagens))
      .catch(aoErro);
    // Abre logo a ouvir, se o browser já deixar usar o microfone sem um toque
    entrarModoVoz(true);
    return () => {
      modoVozRef.current = false;
      gravador.parar();
      calar();
    };
  }, []);

  useEffect(() => {
    if (menu === "conversa") fundo.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, aPensar, menu]);

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
    if (!limpo) return;
    setErro("");
    setTexto("");
    const temp: Mensagem = { id: -Date.now(), papel: "user", texto: limpo, por_voz: porVoz ? 1 : 0, criado_em: "" };
    setMensagens((m) => [...m, temp]);
    setAPensar(true);
    try {
      const { resposta } = await api.enviar(limpo, porVoz);
      setMensagens((m) => [...m, { id: Date.now(), papel: "assistant", texto: resposta, por_voz: 0, criado_em: "" }]);
      if (porVoz && vozLigadaRef.current && modoVozRef.current) falar(resposta);
      else if (modoVozRef.current) ouvir(); // voz desligada: volta logo a ouvir
    } catch (e) {
      aoErro(e);
      setErro(e instanceof Error ? e.message : "Não consegui responder.");
      sairModoVoz();
    } finally {
      setAPensar(false);
    }
  }

  function submeter(e: FormEvent) {
    e.preventDefault();
    if (!aPensar) enviar(texto, false);
  }

  function sairModoVoz() {
    modoVozRef.current = false;
    setModoVoz(false);
  }

  async function ouvir(soSeAtivo = false): Promise<boolean> {
    setErro("");
    calar();
    try {
      const ok = await gravador.comecar({ aoSilencio: terminarDeFalar, silencioMs: 3000, soSeAtivo });
      if (!ok) sairModoVoz();
      return ok;
    } catch {
      if (!soSeAtivo) setErro("Não consegui usar o microfone. Verifica a permissão no Chrome.");
      sairModoVoz();
      return false;
    }
  }

  async function entrarModoVoz(automatico = false) {
    if (automatico) {
      // Sem permissão já dada não se pede nada ao abrir; espera-se pelo toque na bola
      const estado = await navigator.permissions?.query({ name: "microphone" as PermissionName }).catch(() => null);
      if (estado?.state !== "granted") return;
    }
    modoVozRef.current = true;
    setModoVoz(true);
    await ouvir(automatico);
  }

  async function terminarDeFalar(falou = true) {
    const audio = await gravador.parar();
    if (!falou || !audio) {
      sairModoVoz(); // ficou calado: para sem fazer barulho
      return;
    }
    setAPensar(true);
    try {
      const { texto: transcrito } = await api.transcrever(audio);
      setAPensar(false);
      if (transcrito) await enviar(transcrito, true);
      else {
        setErro("Não percebi. Toca na bola e tenta outra vez.");
        sairModoVoz();
      }
    } catch (e) {
      aoErro(e);
      setAPensar(false);
      setErro(e instanceof Error ? e.message : "A transcrição falhou.");
      sairModoVoz();
    }
  }

  // Quando ela acaba de falar, volta a ouvir se o modo de voz estiver ligado
  const falavaAntes = useRef(false);
  useEffect(() => {
    if (falavaAntes.current && !falando && modoVozRef.current) ouvir();
    falavaAntes.current = falando;
  }, [falando]);

  function tocarNaBola() {
    if (modoVoz || falando || gravador.aGravar) {
      sairModoVoz();
      gravador.parar();
      calar();
      return;
    }
    if (aPensar) {
      sairModoVoz(); // a resposta chega na mesma, mas não é lida nem volta a ouvir
      return;
    }
    entrarModoVoz();
  }

  // Botão de baixo: microfone para começar; a ouvir, envia já; a pensar ou a responder, para tudo.
  function botaoFalar() {
    if (gravador.aGravar) {
      terminarDeFalar(true);
      return;
    }
    tocarNaBola();
  }

  const estadoOrbe: EstadoOrbe = gravador.aGravar ? "ouvir" : aPensar ? "pensar" : falando ? "falar" : "repouso";
  const ultima = [...mensagens].reverse().find((m) => m.papel === "assistant");
  const whatsapp = ultima ? linkWhatsApp(ultima.texto) : null;

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex justify-end px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={() => setMenu("conversa")} aria-label="Abrir menu" className="p-3 text-suave">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h10" />
          </svg>
        </button>
      </header>

      <button
        onClick={tocarNaBola}
        aria-label={modoVoz ? "Parar a conversa por voz" : "Falar com a Trinity"}
        className="flex min-h-0 flex-1 items-center justify-center"
      >
        <Orbe estado={estadoOrbe} nivelMic={gravador.nivel} className="aspect-square w-[min(100vw,72vh)]" />
      </button>

      <div className="flex flex-col items-center justify-start gap-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {erro && <p className="text-center text-sm text-amber-300">{erro}</p>}
        {whatsapp && !gravador.aGravar && !aPensar && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#25d366] px-6 py-3 text-sm font-medium text-black"
          >
            Abrir no WhatsApp
          </a>
        )}
        <button
          onClick={botaoFalar}
          aria-label={gravador.aGravar ? "Enviar já" : modoVoz || falando ? "Parar" : "Falar"}
          className={`relative mt-1 grid h-20 w-20 place-items-center rounded-full transition-colors ${
            gravador.aGravar ? "bg-red-500 text-white" : modoVoz || falando || aPensar ? "bg-white/10 text-texto" : "bg-destaque text-black"
          }`}
        >
          {gravador.aGravar && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />}
          {gravador.aGravar ? (
            <span className="relative h-6 w-6 rounded-md bg-white" />
          ) : modoVoz || falando || aPensar ? (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-9 w-9 fill-current">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
          )}
        </button>
        <p className="h-4 text-xs tracking-[0.2em] text-suave">
          {gravador.aGravar ? "A OUVIR" : aPensar ? "A PENSAR" : falando ? "A RESPONDER" : ""}
        </p>
      </div>

      {menu && (
        <div className="absolute inset-0 z-10 flex flex-col bg-fundo">
          <header className="flex items-center gap-6 px-6 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
            {(
              [
                ["conversa", "Conversa"],
                ["hoje", "O meu dia"],
              ] as const
            ).map(([id, nome]) => (
              <button key={id} onClick={() => setMenu(id)} className={`py-2 text-sm ${menu === id ? "text-texto" : "text-suave"}`}>
                {nome}
                <span className={`mx-auto mt-1 block h-1 w-1 rounded-full ${menu === id ? "bg-destaque" : "bg-transparent"}`} />
              </button>
            ))}
            <div className="ml-auto flex items-center">
              <button onClick={alternarVoz} aria-label={vozLigada ? "Desligar a voz" : "Ligar a voz"} className="p-2 text-suave">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                  {vozLigada ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6m0-6-5 6" />}
                </svg>
              </button>
              <button onClick={() => setMenu(null)} aria-label="Fechar menu" className="p-2 text-suave">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </header>

          {menu === "hoje" ? (
            <div className="min-h-0 flex-1">
              <Hoje aoErro={aoErro} irParaConversa={() => setMenu(null)} />
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
                {mensagens.length === 0 && <p className="pt-10 text-center text-sm text-suave">Ainda não há conversa.</p>}
                {mensagens.map((m) =>
                  m.papel === "user" ? (
                    <p key={m.id} className="ml-auto max-w-[85%] text-right text-[15px] text-suave">
                      {m.texto}
                    </p>
                  ) : (
                    <div key={m.id} className="markdown max-w-[95%] text-[15px] leading-7 text-texto/90">
                      <Texto>{m.texto}</Texto>
                    </div>
                  ),
                )}
                {aPensar && <p className="text-sm text-suave">A pensar…</p>}
                <div ref={fundo} />
              </div>
              <form onSubmit={submeter} className="flex items-end gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!aPensar) enviar(texto, false);
                    }
                  }}
                  rows={1}
                  placeholder="Escrever à Trinity"
                  className="max-h-32 min-h-12 flex-1 resize-none rounded-3xl border border-linha bg-white/[0.03] px-5 py-3 text-texto placeholder:text-suave outline-none focus:border-destaque/50"
                />
                <button
                  disabled={aPensar || !texto.trim()}
                  aria-label="Enviar"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-destaque text-black disabled:opacity-30"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
