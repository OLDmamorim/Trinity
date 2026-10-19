// Rotas HTTP da Trinity.
import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { entrar, sair, exigirSessao } from "./auth.js";
import * as db from "./db.js";
import { responder } from "./agente.js";
import { transcrever, sintetizar, textoParaFalar } from "./voz.js";
import { Readable } from "node:stream";
import { gerarBriefing } from "./briefing.js";
import { chavePublica } from "./push.js";
import { diaLisboa } from "./datas.js";
import { config } from "./config.js";
import * as google from "./google.js";
import Anthropic from "@anthropic-ai/sdk";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

export function erroParaUtilizador(e: unknown): string {
  console.error(e);
  if (e instanceof Error && /credit balance is too low/i.test(e.message)) {
    return "A conta da Anthropic ficou sem créditos. Carrega créditos em console.anthropic.com (Plans & Billing) e tenta outra vez.";
  }
  if (e instanceof Anthropic.AuthenticationError || (e instanceof Error && /authentication method/i.test(e.message))) {
    return "A Trinity ainda não está ligada ao Claude (falta a chave ANTHROPIC_API_KEY no servidor).";
  }
  if (e instanceof Anthropic.RateLimitError) return "Muitos pedidos seguidos. Espera um minuto e tenta outra vez.";
  if (e instanceof Anthropic.APIConnectionError) return "Não consegui falar com o Claude. Verifica a ligação e tenta outra vez.";
  if (e instanceof Anthropic.APIError) return "O Claude devolveu um erro. Tenta outra vez daqui a pouco.";
  return e instanceof Error ? e.message : "Algo correu mal.";
}

export function criarApp(pastaCliente?: string) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/saude", (_req, res) => res.json({ ok: true }));
  app.post("/api/entrar", entrar);
  app.post("/api/sair", sair);

  const api = express.Router();
  api.use(exigirSessao);

  api.get("/sessao", (_req, res) => res.json({ ok: true }));

  api.get("/conversa", (_req, res) => res.json({ mensagens: db.ultimasMensagens(100) }));

  api.delete("/conversa", (_req, res) => {
    db.apagarConversa();
    res.json({ ok: true });
  });

  api.post("/conversa", async (req, res) => {
    const texto = typeof req.body?.texto === "string" ? req.body.texto.trim() : "";
    if (!texto) return res.status(400).json({ erro: "Mensagem vazia." });
    try {
      const resposta = await responder(texto, Boolean(req.body?.porVoz));
      res.json({ resposta });
    } catch (e) {
      res.status(502).json({ erro: erroParaUtilizador(e) });
    }
  });

  api.post("/voz", upload.single("audio"), async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: "Falta o áudio." });
    try {
      const texto = await transcrever(req.file.buffer, req.file.mimetype, req.file.originalname);
      res.json({ texto });
    } catch (e) {
      res.status(502).json({ erro: erroParaUtilizador(e) });
    }
  });

  // A fala em dois passos: o POST guarda o texto e devolve um id; o <audio> pede o
  // GET com esse id e começa a tocar enquanto o mp3 ainda está a chegar.
  const falasPendentes = new Map<string, { texto: string; ate: number }>();
  api.post("/fala", (req, res) => {
    const texto = typeof req.body?.texto === "string" ? textoParaFalar(req.body.texto) : "";
    if (!texto) return res.status(400).json({ erro: "Texto vazio." });
    if (!config.openaiKey) return res.status(503).json({ erro: "Voz natural não configurada." });
    const agora = Date.now();
    for (const [id, f] of falasPendentes) if (f.ate < agora) falasPendentes.delete(id);
    const id = crypto.randomUUID();
    falasPendentes.set(id, { texto, ate: agora + 60_000 });
    res.json({ id });
  });

  api.get("/fala/:id", async (req, res) => {
    const fala = falasPendentes.get(req.params.id);
    if (!fala) return res.status(404).end();
    falasPendentes.delete(req.params.id);
    const parar = new AbortController();
    res.on("close", () => parar.abort());
    try {
      const resp = await sintetizar(fala.texto, AbortSignal.any([parar.signal, AbortSignal.timeout(60_000)]));
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      Readable.fromWeb(resp.body as never).on("error", () => res.end()).pipe(res);
    } catch (e) {
      if (!res.headersSent) res.status(502).json({ erro: erroParaUtilizador(e) });
    }
  });

  api.get("/hoje", (_req, res) => {
    res.json({ briefing: db.briefingDoDia(diaLisboa()) ?? null });
  });

  api.post("/hoje", async (_req, res) => {
    try {
      res.json({ briefing: await gerarBriefing(false) });
    } catch (e) {
      res.status(502).json({ erro: erroParaUtilizador(e) });
    }
  });

  api.get("/memorias", (_req, res) => res.json({ memorias: db.listarMemorias() }));
  api.delete("/memorias/:id", (req, res) => res.json({ apagada: db.apagarMemoria(Number(req.params.id)) }));

  api.get("/push/chave", (_req, res) => res.json({ chave: chavePublica() }));
  api.post("/push/subscrever", (req, res) => {
    const sub = req.body;
    if (!sub?.endpoint) return res.status(400).json({ erro: "Subscrição inválida." });
    db.guardarSubscricao(sub.endpoint, sub);
    res.json({ ok: true });
  });

  // Google Calendar: ligar (vai ao Google), regresso com o código, estado e desligar
  const COOKIE_ESTADO = "trinity_google_estado";
  api.get("/google/estado", (_req, res) => {
    res.json({ configurado: google.googleConfigurado(), ligado: google.googleLigado() });
  });

  api.get("/google/ligar", (_req, res) => {
    if (!google.googleConfigurado()) return res.status(400).send("O Google Calendar ainda não está configurado no servidor.");
    const estado = crypto.randomBytes(16).toString("hex");
    res.cookie(COOKIE_ESTADO, estado, { httpOnly: true, sameSite: "lax", secure: config.producao, maxAge: 10 * 60 * 1000, path: "/api/google" });
    res.redirect(google.urlAutorizacao(estado));
  });

  api.get("/google/retorno", async (req, res) => {
    const estado = String(req.query.state ?? "");
    const esperado = req.cookies?.[COOKIE_ESTADO];
    res.clearCookie(COOKIE_ESTADO, { path: "/api/google" });
    if (!esperado || estado !== esperado || typeof req.query.code !== "string") return res.redirect("/?google=erro");
    try {
      await google.concluirLigacao(req.query.code);
      res.redirect("/?google=ligado");
    } catch (e) {
      console.error("[google] ligação falhou:", e);
      res.redirect("/?google=erro");
    }
  });

  api.post("/google/desligar", (_req, res) => {
    google.desligar();
    res.json({ ok: true });
  });

  app.use("/api", api);

  // App web (build do Vite)
  if (pastaCliente && fs.existsSync(pastaCliente)) {
    app.use(express.static(pastaCliente, { index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(pastaCliente, "index.html")));
  }

  return app;
}
