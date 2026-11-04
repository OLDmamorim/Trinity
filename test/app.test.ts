import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";

process.env.TRINITY_PASSWORD = "segredo-de-teste";
process.env.TRINITY_SESSION_SECRET = "s".repeat(40);

vi.mock("../server/agente.js", () => ({
  responder: vi.fn(async (texto: string) => `Eco: ${texto}`),
  gerarTextoBriefing: vi.fn(async () => "**Prioridade:** visitar a loja de Braga."),
}));

const { abrirDb, fecharDb } = await import("../server/db.js");
const { criarApp } = await import("../server/app.js");

let servidor: Server;
let base = "";
let cookie = "";

beforeAll(async () => {
  abrirDb(":memory:");
  servidor = criarApp().listen(0);
  await new Promise((r) => servidor.once("listening", r));
  const addr = servidor.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(() => {
  servidor.close();
  fecharDb();
});

const post = (caminho: string, corpo: unknown) =>
  fetch(base + caminho, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(corpo) });

describe("API", () => {
  it("exige sessão", async () => {
    expect((await fetch(`${base}/api/conversa`)).status).toBe(401);
  });

  it("recusa palavra-passe errada e aceita a certa", async () => {
    expect((await post("/api/entrar", { palavraPasse: "errada" })).status).toBe(401);
    const ok = await post("/api/entrar", { palavraPasse: "segredo-de-teste" });
    expect(ok.status).toBe(200);
    cookie = ok.headers.get("set-cookie")!.split(";")[0];
    expect(cookie).toMatch(/^trinity_sessao=/);
  });

  it("conversa e guarda o histórico", async () => {
    const r = await post("/api/conversa", { texto: "olá" });
    expect(await r.json()).toEqual({ resposta: "Eco: olá" });
    const vazia = await post("/api/conversa", { texto: "  " });
    expect(vazia.status).toBe(400);
  });

  it("gera e devolve o briefing do dia", async () => {
    const gerado = await (await post("/api/hoje", {})).json();
    expect(gerado.briefing.texto).toContain("Braga");
    const hoje = await (await fetch(`${base}/api/hoje`, { headers: { cookie } })).json();
    expect(hoje.briefing.id).toBe(gerado.briefing.id);
  });

  it("guarda subscrições push", async () => {
    expect((await post("/api/push/subscrever", {})).status).toBe(400);
    expect((await post("/api/push/subscrever", { endpoint: "https://push.example/1", keys: {} })).status).toBe(200);
  });
});

describe("Google Calendar (rotas)", () => {
  it("recusa o regresso sem o estado certo", async () => {
    const r = await fetch(`${base}/api/google/retorno?code=x&state=errado`, { headers: { cookie }, redirect: "manual" });
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/?google=erro");
  });

  it("diz se está configurado e ligado", async () => {
    const r = await fetch(`${base}/api/google/estado`, { headers: { cookie } });
    expect(await r.json()).toEqual({ configurado: false, ligado: false });
  });
});
