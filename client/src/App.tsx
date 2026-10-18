import { useEffect, useState } from "react";
import { api, SemSessao } from "./api";
import Entrar from "./paginas/Entrar";
import Hoje from "./paginas/Hoje";
import Conversa from "./paginas/Conversa";
import ChuvaMatrix from "./ChuvaMatrix";

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

  if (estado === "a-verificar")
    return (
      <>
        <ChuvaMatrix />
        <div className="cursor grid h-full place-items-center uppercase tracking-[0.3em] text-matrix brilho">A ligar</div>
      </>
    );
  if (estado === "fora")
    return (
      <>
        <ChuvaMatrix />
        <Entrar aoEntrar={() => setEstado("dentro")} />
      </>
    );

  return (
    <div className="flex h-full flex-col">
      <ChuvaMatrix />
      <main className="min-h-0 flex-1">
        {ecra === "hoje" ? (
          <Hoje aoErro={semSessao} irParaConversa={() => setEcra("conversa")} />
        ) : (
          <Conversa aoErro={semSessao} />
        )}
      </main>
      <nav className="grid grid-cols-2 border-t border-matrix/30 bg-black/80 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {(
          [
            ["hoje", "Hoje"],
            ["conversa", "Conversa"],
          ] as const
        ).map(([id, nome]) => (
          <button
            key={id}
            onClick={() => setEcra(id)}
            className={`py-4 text-sm uppercase tracking-[0.2em] ${ecra === id ? "text-matrix brilho" : "text-matrix-escuro"}`}
          >
            {ecra === id ? `[ ${nome} ]` : nome}
          </button>
        ))}
      </nav>
    </div>
  );
}
