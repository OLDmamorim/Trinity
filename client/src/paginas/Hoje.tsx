import { useEffect, useState } from "react";
import Texto from "../Texto";
import { api, type Briefing } from "../api";
import { calar, falar } from "../fala";
import { ativarNotificacoes, notificacoesSuportadas } from "../notificacoes";
import { useFalando } from "../useFalando";

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
  const [google, setGoogle] = useState<{ configurado: boolean; ligado: boolean } | null>(null);
  const [mostrarNotif, setMostrarNotif] = useState(
    notificacoesSuportadas() && typeof Notification !== "undefined" && Notification.permission === "default",
  );
  const falando = useFalando();

  useEffect(() => {
    // Regresso do Google depois de autorizar o calendário
    const resultado = new URLSearchParams(window.location.search).get("google");
    if (resultado) {
      setAviso(resultado === "ligado" ? "Google Calendar ligado." : "Não foi possível ligar o Google Calendar. Tenta outra vez.");
      window.history.replaceState(null, "", "/");
    }
    api.googleEstado().then(setGoogle).catch(() => {});
  }, []);

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
    <div className="h-full overflow-y-auto px-6 pb-10 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="etiqueta">{dataHoje}</p>
          <h1 className="mt-2 text-3xl font-light tracking-tight">{saudacao()}, Marco</h1>
        </div>
      </div>

      {mostrarNotif && (
        <button onClick={notificacoes} className="mt-6 flex w-full items-center justify-between border-b border-linha py-3 text-left text-sm text-suave">
          Receber o briefing todas as manhãs <span className="text-destaque">Ativar</span>
        </button>
      )}

      {google?.configurado && !google.ligado && (
        <a href="/api/google/ligar" className="mt-2 flex w-full items-center justify-between border-b border-linha py-3 text-sm text-suave">
          Google Calendar <span className="text-destaque">Ligar</span>
        </a>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="etiqueta">O teu dia</h2>
          <div className="flex gap-5 text-sm">
            {briefing && (
              <button onClick={() => (falando ? calar() : falar(briefing.texto))} className="text-destaque">
                {falando ? "Parar" : "Ouvir"}
              </button>
            )}
            <button onClick={gerar} disabled={aGerar} className="text-suave disabled:opacity-50">
              {aGerar ? "A preparar…" : briefing ? "Atualizar" : "Preparar"}
            </button>
          </div>
        </div>
        {aCarregar ? (
          <p className="text-suave">A carregar…</p>
        ) : briefing ? (
          <div className="markdown text-[15px] leading-7 text-texto/90">
            <Texto>{briefing.texto}</Texto>
          </div>
        ) : (
          <p className="text-suave">Ainda não há briefing para hoje. Toca em Preparar.</p>
        )}
      </section>

      {aviso && <p className="mt-6 text-sm text-amber-300">{aviso}</p>}
    </div>
  );
}
