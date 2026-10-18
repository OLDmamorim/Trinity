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
      <form onSubmit={submeter} className="painel w-full max-w-sm space-y-5 rounded-lg p-6">
        <div className="text-center">
          <img src="/icone.svg" alt="" className="mx-auto mb-4 h-20 w-20 rounded-lg shadow-[0_0_24px_rgba(0,255,65,0.45)]" />
          <h1 className="falha text-3xl uppercase tracking-[0.35em] text-matrix brilho">Trinity</h1>
          <p className="cursor mt-2 text-xs uppercase tracking-[0.2em] text-matrix-escuro">Acesso restrito</p>
        </div>
        {/* username escondido para o Chrome guardar a palavra-passe e preencher com a impressão digital */}
        <input type="text" name="username" autoComplete="username" value="marco" readOnly hidden />
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="> palavra-passe"
          value={palavraPasse}
          onChange={(e) => setPalavraPasse(e.target.value)}
          className="w-full rounded-md border border-matrix/30 bg-black/70 px-4 py-3 text-matrix-claro placeholder:text-matrix-escuro outline-none focus:border-matrix focus:shadow-[0_0_12px_rgba(0,255,65,0.4)]"
          autoFocus
        />
        {erro && <p className="text-sm text-red-400">{erro}</p>}
        <button
          disabled={aEntrar || !palavraPasse}
          className="botao-matrix w-full rounded-md py-3 disabled:opacity-40"
        >
          {aEntrar ? "A autenticar…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
