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
      <p className="text-sm text-slate-400 first-letter:uppercase">{dataHoje}</p>
      <h1 className="mt-1 text-3xl font-semibold text-white">{saudacao()}, Marco</h1>

      {mostrarNotif && (
        <button
          onClick={notificacoes}
          className="mt-5 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-left text-sm text-cyan-200"
        >
          Ativar notificações para receberes o briefing todas as manhãs
        </button>
      )}

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-white">O teu dia</h2>
          {briefing && (
            <button onClick={() => falar(briefing.texto)} className="text-sm text-cyan-300">
              Ouvir
            </button>
          )}
        </div>
        {aCarregar ? (
          <p className="text-slate-500">A carregar…</p>
        ) : briefing ? (
          <div className="markdown text-[15px] leading-relaxed text-slate-200">
            <Markdown>{briefing.texto}</Markdown>
          </div>
        ) : (
          <p className="text-slate-400">Ainda não há briefing para hoje.</p>
        )}
        <button
          onClick={gerar}
          disabled={aGerar}
          className="mt-4 w-full rounded-xl bg-white/10 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {aGerar ? "A preparar com os dados do PoweringEG…" : briefing ? "Atualizar" : "Preparar o meu dia"}
        </button>
      </section>

      {aviso && <p className="mt-4 text-sm text-amber-300">{aviso}</p>}

      <button onClick={irParaConversa} className="mt-6 w-full rounded-2xl bg-cyan-500 py-4 font-semibold text-slate-950">
        Falar com a Trinity
      </button>
    </div>
  );
}
