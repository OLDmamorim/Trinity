import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { api, type Briefing } from "../api";
import { falar } from "../fala";
import { ativarNotificacoes, notificacoesSuportadas } from "../notificacoes";

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 13) return "Bom dia";
  if (h < 20) return "Boa tarde";
  return "Boa noite";
}

export default function Hoje({ aoErro, irParaConversa }: { aoErro: (e: unknown) => void; irParaConversa: () => void }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [aGerar, setAGerar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [mostrarNotif, setMostrarNotif] = useState(
    notificacoesSuportadas() && typeof Notification !== "undefined" && Notification.permission === "default",
  );

  useEffect(() => {
    api
      .hoje()
      .then((r) => setBriefing(r.briefing))
      .catch((e) => {
        aoErro(e);
        setAviso(e instanceof Error ? e.message : "Erro a carregar.");
      })
      .finally(() => setACarregar(false));
  }, []);

  async function gerar() {
    setAGerar(true);
    setAviso("");
    try {
      setBriefing((await api.gerarHoje()).briefing);
    } catch (e) {
      aoErro(e);
      setAviso(e instanceof Error ? e.message : "Não foi possível preparar o briefing.");
    } finally {
      setAGerar(false);
    }
  }

  async function notificacoes() {
    setAviso(await ativarNotificacoes().catch((e) => (e instanceof Error ? e.message : "Erro nas notificações.")));
    setMostrarNotif(false);
  }

  const dataHoje = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="h-full overflow-y-auto px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <p className="text-xs uppercase tracking-[0.2em] text-matrix-escuro">// {dataHoje}</p>
      <h1 className="falha mt-2 text-3xl text-matrix brilho">{saudacao()}, Marco</h1>

      {mostrarNotif && (
        <button
          onClick={notificacoes}
          className="painel mt-5 w-full rounded-md px-4 py-3 text-left text-sm text-matrix-claro"
        >
          &gt; Ativar notificações para receberes o briefing todas as manhãs
        </button>
      )}

      <section className="painel mt-6 rounded-lg p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.25em] text-matrix brilho">&gt; O teu dia</h2>
          {briefing && (
            <button onClick={() => falar(briefing.texto)} className="text-xs uppercase tracking-[0.2em] text-matrix">
              Ouvir
            </button>
          )}
        </div>
        {aCarregar ? (
          <p className="cursor text-matrix-escuro">A carregar</p>
        ) : briefing ? (
          <div className="markdown text-[15px] leading-relaxed text-matrix-claro">
            <Markdown>{briefing.texto}</Markdown>
          </div>
        ) : (
          <p className="text-matrix-escuro">Ainda não há briefing para hoje.</p>
        )}
        <button
          onClick={gerar}
          disabled={aGerar}
          className="mt-4 w-full rounded-md border border-matrix/30 bg-black/60 py-3 text-sm uppercase tracking-[0.15em] text-matrix disabled:opacity-50"
        >
          {aGerar ? "A preparar com os dados do PoweringEG…" : briefing ? "Atualizar" : "Preparar o meu dia"}
        </button>
      </section>

      {aviso && <p className="mt-4 text-sm text-amber-300">{aviso}</p>}

      <button onClick={irParaConversa} className="botao-matrix mt-6 w-full rounded-md py-4">
        Falar com a Trinity
      </button>
    </div>
  );
}
