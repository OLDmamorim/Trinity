// O cérebro da Trinity: Claude com ferramentas para ler o PoweringEG e gerir memórias.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config.js";
import { agoraPorExtenso, diaLisboa } from "./datas.js";
import * as db from "./db.js";
import * as powering from "./powering.js";
import * as google from "./google.js";

let cliente: Anthropic | null = null;
function claude(): Anthropic {
  cliente ??= new Anthropic();
  return cliente;
}

export const INSTRUCOES = `És a Trinity, a assistente pessoal do Marco. O Marco é gestor de zona na Express Glass e usa a plataforma PoweringEG para supervisionar as suas lojas (visitas, relatórios, pendentes, KPIs, resultados, NPS, volantes, frota, RH, reuniões).

Como falas:
- Português de Portugal, tom próximo e direto, como uma colega de confiança.
- Respostas curtas. Muitas vezes o Marco está a conduzir ou entre lojas e pode ouvir a resposta em voz alta, por isso evita tabelas e listas longas, a não ser que ele peça detalhe.
- Responde primeiro exatamente ao que ele perguntou (se pergunta pela agenda de amanhã, começa pela agenda de amanhã). Só depois, se valer a pena, acrescenta uma sugestão em uma ou duas frases. Sem rodeios nem frases de cortesia.

O que fazes:
- Respondes a perguntas sobre o dia dele e sobre as lojas, com dados reais do PoweringEG. Usa as ferramentas sempre que a pergunta depender de dados; nunca inventes números, nomes de lojas ou datas.
- Dás orientação prática: o que fazer primeiro, que loja visitar, que pendente está a ficar velho, que KPI precisa de atenção.
- Quando o Marco te conta uma preferência, objetivo ou facto pessoal que vale a pena lembrar, guarda-o com a ferramenta guardar_memoria. Não guardes coisas passageiras.
- Se uma ferramenta falhar ou o PoweringEG não estiver ligado, diz isso numa frase e ajuda com o que tiveres.
- Tens acesso ao Google Calendar dele (todos os calendários). Para perguntas sobre agenda, disponibilidade ou o dia, usa a ferramenta agenda e junta com as reuniões agendadas do PoweringEG.
- Para marcar alguma coisa usa criar_marcacao. Se ele disse claramente o quê, o dia e a hora (ou que é o dia todo), cria logo e confirma numa frase. Se faltar o dia ou a hora, pergunta antes. Datas relativas ("amanhã", "sexta") contam a partir do dia de hoje indicado na mensagem.
- Se o Google Calendar não estiver ligado, diz-lhe para tocar em "Ligar Google Calendar" no separador Hoje.
- Ainda não tens acesso ao Gmail nem ao YouTube; essas ligações vêm a seguir.`;

function blocoMemorias(): string {
  const memorias = db.listarMemorias();
  if (memorias.length === 0) return "Ainda não tens memórias guardadas sobre o Marco.";
  return "O que sabes sobre o Marco (memórias guardadas, cada uma com o seu id):\n" + memorias.map((m) => `- [${m.id}] ${m.texto}`).join("\n");
}

function emJson(dados: unknown): string {
  return JSON.stringify(dados);
}

async function seguro(fn: () => Promise<unknown>): Promise<string> {
  try {
    return emJson(await fn());
  } catch (e) {
    return emJson({ erro: e instanceof Error ? e.message : String(e) });
  }
}

const ferramentas = [
  betaZodTool({
    name: "resumo_powering",
    description:
      "Resumo pessoal do Marco no PoweringEG: as suas lojas (com dias desde a última visita), pendentes ativos, tarefas por fazer, alertas, visitas recentes, reuniões agendadas, lembretes e entradas recentes do diário de bordo. Usa para quase todas as perguntas sobre o dia, prioridades e lojas.",
    inputSchema: z.object({
      dias: z.number().int().min(1).max(90).optional().describe("Quantos dias para trás nas visitas e no diário (por omissão 14)."),
    }),
    run: ({ dias }) => seguro(() => powering.obterResumo(dias)),
  }),
  betaZodTool({
    name: "resultados_lojas",
    description:
      "Resultados mensais das lojas (serviços, objetivos, taxas de reparação, etc.) para um mês. Sem lojaId devolve todas as lojas da rede; com lojaId devolve o histórico dessa loja.",
    inputSchema: z.object({
      mes: z.number().int().min(1).max(12).optional(),
      ano: z.number().int().min(2020).max(2100).optional(),
      lojaId: z.number().int().optional().describe("Id da loja, tirado do resumo_powering."),
    }),
    run: ({ mes, ano, lojaId }) => seguro(() => powering.obterResultados(mes, ano, lojaId)),
  }),
  betaZodTool({
    name: "nps_lojas",
    description: "Dados de NPS (satisfação dos clientes) por loja e mês.",
    inputSchema: z.object({
      mes: z.number().int().min(1).max(12).optional(),
      ano: z.number().int().min(2020).max(2100).optional(),
      lojaId: z.number().int().optional(),
    }),
    run: ({ mes, ano, lojaId }) => seguro(() => powering.obterNps(mes, ano, lojaId)),
  }),
  betaZodTool({
    name: "agenda",
    description:
      "Eventos do Google Calendar do Marco (todos os calendários visíveis) entre dois dias, inclusive, na hora de Lisboa. Sem datas, devolve o dia de hoje.",
    inputSchema: z.object({
      de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Primeiro dia, AAAA-MM-DD."),
      ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Último dia, AAAA-MM-DD (por omissão, o mesmo que 'de')."),
    }),
    run: ({ de, ate }) => {
      const inicio = de ?? diaLisboa();
      return seguro(() => google.agenda(inicio, ate ?? inicio));
    },
  }),
  betaZodTool({
    name: "criar_marcacao",
    description:
      "Cria um evento no Google Calendar do Marco. Horas em hora de Lisboa. Sem fim, dura 1 hora (ou o dia todo, se for de dia inteiro).",
    inputSchema: z.object({
      titulo: z.string().min(1).max(200),
      inicio: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/)
        .describe("AAAA-MM-DDTHH:MM, ou só AAAA-MM-DD para um evento de dia inteiro."),
      fim: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).optional(),
      local: z.string().max(300).optional(),
      descricao: z.string().max(2000).optional(),
      calendario: z.string().max(200).optional().describe("Nome do calendário; por omissão, o principal."),
    }),
    run: (ev) => seguro(() => google.criarEvento(ev)),
  }),
  betaZodTool({
    name: "guardar_memoria",
    description: "Guarda um facto duradouro sobre o Marco (preferência, objetivo, rotina, pessoa importante). Uma frase curta.",
    inputSchema: z.object({ texto: z.string().min(3).max(500) }),
    run: async ({ texto }) => emJson({ guardada: db.guardarMemoria(texto.trim()) }),
  }),
  betaZodTool({
    name: "apagar_memoria",
    description: "Apaga uma memória que deixou de ser verdade ou que o Marco pediu para esquecer.",
    inputSchema: z.object({ id: z.number().int() }),
    run: async ({ id }) => emJson({ apagada: db.apagarMemoria(id) }),
  }),
];

function textoFinal(msg: Anthropic.Beta.BetaMessage): string {
  if (msg.stop_reason === "refusal") return "Desculpa, não consigo ajudar com isso.";
  const texto = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return texto || "Não consegui preparar uma resposta. Tenta outra vez.";
}

/** Responde a uma mensagem do Marco, com o histórico recente como contexto. */
export async function responder(pergunta: string, porVoz = false): Promise<string> {
  const historico = db.ultimasMensagens(30);
  db.guardarMensagem("user", pergunta, porVoz);

  const messages: Anthropic.Beta.BetaMessageParam[] = historico.map((m) => ({ role: m.papel, content: m.texto }));
  const contexto = `[Agora: ${agoraPorExtenso()}${porVoz ? " · mensagem por voz, a resposta vai ser lida em voz alta" : ""}]`;
  messages.push({ role: "user", content: `${contexto}\n${pergunta}` });

  const final = await claude().beta.messages.toolRunner({
    model: config.modelo,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: config.esforco },
    system: [
      { type: "text", text: INSTRUCOES, cache_control: { type: "ephemeral" } },
      { type: "text", text: blocoMemorias() },
    ],
    tools: ferramentas,
    messages,
    max_iterations: 8,
  });

  const resposta = textoFinal(final);
  db.guardarMensagem("assistant", resposta);
  return resposta;
}

export const INSTRUCOES_BRIEFING = `Preparas o briefing da manhã do Marco a partir dos dados do PoweringEG que te são dados.

Formato (markdown simples, português de Portugal, no máximo ~180 palavras):
- Uma linha de abertura com o essencial do dia.
- "Prioridades": 3 a 5 pontos concretos, por ordem, cada um com o porquê (ex.: pendente crítico há 12 dias na loja X; loja Y sem visita há 40 dias; reunião às 10h).
- "Atenção": no máximo 2 alertas ou riscos, só se existirem.
Inclui os eventos de hoje do Google Calendar (se vierem) nas prioridades, com a hora.
Usa só os dados fornecidos; não inventes. Se faltarem dados, diz numa frase.`;

async function agendaDeHoje(): Promise<string> {
  if (!google.googleLigado()) return "";
  try {
    const hoje = diaLisboa();
    return `\n\nGoogle Calendar de hoje:\n${emJson(await google.agenda(hoje, hoje))}`;
  } catch (e) {
    return `\n\nGoogle Calendar: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Gera o texto do briefing do dia (sem ferramentas: os dados vão no pedido). */
export async function gerarTextoBriefing(): Promise<string> {
  let dados: string;
  try {
    dados = emJson(await powering.obterResumo(14));
  } catch (e) {
    dados = emJson({ erro: e instanceof Error ? e.message : String(e) });
  }

  const msg = await claude().beta.messages.create({
    model: config.modelo,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: config.esforco },
    system: [
      { type: "text", text: INSTRUCOES_BRIEFING },
      { type: "text", text: blocoMemorias() },
    ],
    messages: [{ role: "user", content: `Hoje é ${agoraPorExtenso()}.\n\nDados do PoweringEG:\n${dados}${await agendaDeHoje()}` }],
  });
  return textoFinal(msg);
}
