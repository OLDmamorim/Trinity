import { useState, type FormEvent } from "react";
import { api } from "../api";

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
    <div className="grid h-full place-items-center px-6">
      <form onSubmit={submeter} className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <img src="/icone.svg" alt="" className="mx-auto mb-4 h-20 w-20 rounded-2xl" />
          <h1 className="text-2xl font-semibold text-white">Trinity</h1>
          <p className="mt-1 text-sm text-slate-400">A tua assistente pessoal</p>
        </div>
        {/* username escondido para o Chrome guardar a palavra-passe e preencher com a impressão digital */}
        <input type="text" name="username" autoComplete="username" value="marco" readOnly hidden />
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Palavra-passe"
          value={palavraPasse}
          onChange={(e) => setPalavraPasse(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-400"
          autoFocus
        />
        {erro && <p className="text-sm text-red-400">{erro}</p>}
        <button
          disabled={aEntrar || !palavraPasse}
          className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          {aEntrar ? "A entrar…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
