// Rotas HTTP da Trinity.
import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { entrar, sair, exigirSessao } from "./auth.js";
import * as db from "./db.js";
import { responder } from "./agente.js";
import { transcrever } from "./voz.js";
import { gerarBriefing } from "./briefing.js";
import { chavePublica } from "./push.js";
import { diaLisboa } from "./datas.js";
import Anthropic from "@anthropic-ai/sdk";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function erroParaUtilizador(e: unknown): string {
  console.error(e);
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

  app.use("/api", api);

  // App web (build do Vite)
  if (pastaCliente && fs.existsSync(pastaCliente)) {
    app.use(express.static(pastaCliente, { index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(pastaCliente, "index.html")));
  }

  return app;
}
