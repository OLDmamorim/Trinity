// Acesso de uma só pessoa: palavra-passe + cookie de sessão assinado (HMAC), válido 90 dias.
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

export const COOKIE = "trinity_sessao";
const DURACAO_MS = 90 * 24 * 60 * 60 * 1000;

function assinar(valor: string, segredo: string): string {
  return crypto.createHmac("sha256", segredo).update(valor).digest("base64url");
}

function iguais(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function criarToken(agora = Date.now(), segredo = config.segredoSessao): string {
  const expira = String(agora + DURACAO_MS);
  return `${expira}.${assinar(expira, segredo)}`;
}

export function tokenValido(token: string | undefined, agora = Date.now(), segredo = config.segredoSessao): boolean {
  if (!token || !segredo) return false;
  const [expira, assinatura] = token.split(".");
  if (!expira || !assinatura) return false;
  if (!iguais(assinatura, assinar(expira, segredo))) return false;
  return Number(expira) > agora;
}

export function palavraPasseCorreta(tentativa: string, certa = config.palavraPasse): boolean {
  if (!certa) return false;
  return iguais(tentativa, certa);
}

// Trava tentativas falhadas: 5 por cada 15 minutos, por IP.
const falhas = new Map<string, { n: number; desde: number }>();
const JANELA_MS = 15 * 60 * 1000;

export function bloqueado(ip: string, agora = Date.now()): boolean {
  const f = falhas.get(ip);
  if (!f) return false;
  if (agora - f.desde > JANELA_MS) {
    falhas.delete(ip);
    return false;
  }
  return f.n >= 5;
}

export function registarFalha(ip: string, agora = Date.now()) {
  const f = falhas.get(ip);
  if (!f || agora - f.desde > JANELA_MS) falhas.set(ip, { n: 1, desde: agora });
  else f.n++;
}

export function limparFalhas(ip: string) {
  falhas.delete(ip);
}

export function entrar(req: Request, res: Response) {
  const ip = req.ip ?? "desconhecido";
  if (bloqueado(ip)) return res.status(429).json({ erro: "Demasiadas tentativas. Tenta daqui a 15 minutos." });
  const tentativa = typeof req.body?.palavraPasse === "string" ? req.body.palavraPasse : "";
  if (!palavraPasseCorreta(tentativa)) {
    registarFalha(ip);
    return res.status(401).json({ erro: "Palavra-passe errada." });
  }
  limparFalhas(ip);
  res.cookie(COOKIE, criarToken(), {
    httpOnly: true,
    secure: config.producao,
    sameSite: "lax",
    maxAge: DURACAO_MS,
  });
  res.json({ ok: true });
}

export function sair(_req: Request, res: Response) {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
}

export function exigirSessao(req: Request, res: Response, next: NextFunction) {
  if (tokenValido(req.cookies?.[COOKIE])) return next();
  res.status(401).json({ erro: "Sessão terminada. Entra outra vez." });
}
