// Chamadas ao servidor da Trinity.

export class SemSessao extends Error {}

async function pedir<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const resp = await fetch(`/api${caminho}`, { credentials: "same-origin", ...opcoes });
  if (resp.status === 401) throw new SemSessao();
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro ?? `Erro ${resp.status}`);
  return dados as T;
}

const json = (corpo: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});

export type Mensagem = { id: number; papel: "user" | "assistant"; texto: string; por_voz: number; criado_em: string };
export type Briefing = { id: number; dia: string; texto: string; criado_em: string };

export const api = {
  entrar: (palavraPasse: string) => pedir<{ ok: true }>("/entrar", json({ palavraPasse })),
  sair: () => pedir<{ ok: true }>("/sair", { method: "POST" }),
  sessao: () => pedir<{ ok: true }>("/sessao"),
  conversa: () => pedir<{ mensagens: Mensagem[] }>("/conversa"),
  apagarConversa: () => pedir<{ ok: true }>("/conversa", { method: "DELETE" }),
  enviar: (texto: string, porVoz: boolean) => pedir<{ resposta: string }>("/conversa", json({ texto, porVoz })),
  transcrever: (audio: Blob) => {
    const form = new FormData();
    const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm";
    form.append("audio", audio, `voz.${ext}`);
    return pedir<{ texto: string }>("/voz", { method: "POST", body: form });
  },
  hoje: () => pedir<{ briefing: Briefing | null }>("/hoje"),
  gerarHoje: () => pedir<{ briefing: Briefing }>("/hoje", { method: "POST" }),
  googleEstado: () => pedir<{ configurado: boolean; ligado: boolean }>("/google/estado"),
  chavePush: () => pedir<{ chave: string }>("/push/chave"),
  subscreverPush: (sub: PushSubscriptionJSON) => pedir<{ ok: true }>("/push/subscrever", json(sub)),
};
