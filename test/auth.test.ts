import { describe, expect, it } from "vitest";
import { bloqueado, criarToken, palavraPasseCorreta, registarFalha, tokenValido } from "../server/auth.js";

const SEGREDO = "x".repeat(40);

describe("sessão", () => {
  it("aceita um token acabado de criar", () => {
    expect(tokenValido(criarToken(Date.now(), SEGREDO), Date.now(), SEGREDO)).toBe(true);
  });

  it("rejeita token expirado, adulterado ou assinado com outro segredo", () => {
    const agora = Date.now();
    const token = criarToken(agora, SEGREDO);
    expect(tokenValido(token, agora + 91 * 24 * 3600 * 1000, SEGREDO)).toBe(false);
    const [expira, assinatura] = token.split(".");
    expect(tokenValido(`${Number(expira) + 1}.${assinatura}`, agora, SEGREDO)).toBe(false);
    expect(tokenValido(token, agora, "y".repeat(40))).toBe(false);
    expect(tokenValido(undefined, agora, SEGREDO)).toBe(false);
  });

  it("compara a palavra-passe e recusa quando não está definida", () => {
    expect(palavraPasseCorreta("abc", "abc")).toBe(true);
    expect(palavraPasseCorreta("abd", "abc")).toBe(false);
    expect(palavraPasseCorreta("", "")).toBe(false);
  });

  it("bloqueia o IP após 5 falhas", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i++) registarFalha(ip);
    expect(bloqueado(ip)).toBe(true);
    expect(bloqueado(ip, Date.now() + 16 * 60 * 1000)).toBe(false);
  });
});
