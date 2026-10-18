import { useState, type FormEvent } from "react";
import { api } from "../api";
import Orbe from "../Orbe";

export default function Entrar({ aoEntrar }: { aoEntrar: () => void }) {
  const [palavraPasse, setPalavraPasse] = useState("");
  const [erro, setErro] = useState("");
  const [aEntrar, setAEntrar] = useState(false);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setAEntrar(true);
    try {
      await api.entrar(palavraPasse);
      aoEntrar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setAEntrar(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <Orbe estado={aEntrar ? "pensar" : "repouso"} className="h-52 w-52" />
      <h1 className="mt-2 text-sm tracking-[0.4em] text-texto">TRINITY</h1>
      <form onSubmit={submeter} className="mt-10 w-full max-w-xs space-y-4">
        {/* username escondido para o Chrome guardar a palavra-passe e preencher com a impressão digital */}
        <input type="text" name="username" autoComplete="username" value="marco" readOnly hidden />
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Palavra-passe"
          value={palavraPasse}
          onChange={(e) => setPalavraPasse(e.target.value)}
          className="w-full rounded-full border border-linha bg-white/[0.03] px-5 py-3 text-center text-texto placeholder:text-suave outline-none focus:border-destaque/60"
          autoFocus
        />
        {erro && <p className="text-center text-sm text-red-400">{erro}</p>}
        <button
          disabled={aEntrar || !palavraPasse}
          className="w-full rounded-full bg-destaque py-3 text-sm font-medium text-black transition-opacity disabled:opacity-30"
        >
          {aEntrar ? "A entrar…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
