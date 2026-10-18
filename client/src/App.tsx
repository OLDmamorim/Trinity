import { useEffect, useState } from "react";
import { api, SemSessao } from "./api";
import Entrar from "./paginas/Entrar";
import Hoje from "./paginas/Hoje";
import Conversa from "./paginas/Conversa";

type Ecra = "hoje" | "conversa";

export default function App() {
  const [estado, setEstado] = useState<"a-verificar" | "fora" | "dentro">("a-verificar");
  const [ecra, setEcra] = useState<Ecra>("hoje");

  useEffect(() => {
    api
      .sessao()
      .then(() => setEstado("dentro"))
      .catch(() => setEstado("fora"));
  }, []);

  const semSessao = (e: unknown) => {
    if (e instanceof SemSessao) setEstado("fora");
  };

  if (estado === "a-verificar") return <div className="grid h-full place-items-center text-slate-500">A abrir…</div>;
  if (estado === "fora") return <Entrar aoEntrar={() => setEstado("dentro")} />;

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1">
        {ecra === "hoje" ? (
          <Hoje aoErro={semSessao} irParaConversa={() => setEcra("conversa")} />
        ) : (
          <Conversa aoErro={semSessao} />
        )}
      </main>
      <nav className="grid grid-cols-2 border-t border-white/10 bg-[#0b0f19] pb-[env(safe-area-inset-bottom)]">
        {(
          [
            ["hoje", "Hoje"],
            ["conversa", "Conversa"],
          ] as const
        ).map(([id, nome]) => (
          <button
            key={id}
            onClick={() => setEcra(id)}
            className={`py-4 text-sm font-medium ${ecra === id ? "text-cyan-300" : "text-slate-400"}`}
          >
            {nome}
          </button>
        ))}
      </nav>
    </div>
  );
}
