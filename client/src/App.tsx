import { useEffect, useState } from "react";
import { api, SemSessao } from "./api";
import Entrar from "./paginas/Entrar";
import Hoje from "./paginas/Hoje";
import Conversa from "./paginas/Conversa";
import Orbe from "./Orbe";

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
      <div className="grid h-full place-items-center">
        <Orbe estado="pensar" className="h-40 w-40" />
      </div>
    );
  if (estado === "fora") return <Entrar aoEntrar={() => setEstado("dentro")} />;

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1">
        {ecra === "hoje" ? <Hoje aoErro={semSessao} irParaConversa={() => setEcra("conversa")} /> : <Conversa aoErro={semSessao} />}
      </main>
      <nav className="flex justify-center gap-10 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {(
          [
            ["hoje", "O meu dia"],
            ["conversa", "Trinity"],
          ] as const
        ).map(([id, nome]) => (
          <button key={id} onClick={() => setEcra(id)} className="flex flex-col items-center gap-1.5 py-1">
            <span className={`text-sm ${ecra === id ? "text-texto" : "text-suave"}`}>{nome}</span>
            <span className={`h-1 w-1 rounded-full ${ecra === id ? "bg-destaque" : "bg-transparent"}`} />
          </button>
        ))}
      </nav>
    </div>
  );
}
