import { useEffect, useState } from "react";
import { api, SemSessao } from "./api";
import Entrar from "./paginas/Entrar";
import Conversa from "./paginas/Conversa";
import Orbe from "./Orbe";

export default function App() {
  const [estado, setEstado] = useState<"a-verificar" | "fora" | "dentro">("a-verificar");

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

  return <Conversa aoErro={semSessao} />;
}
