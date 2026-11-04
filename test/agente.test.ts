import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.TRINITY_MODEL = "modelo-texto";
process.env.TRINITY_EFFORT = "medium";
delete process.env.TRINITY_MODEL_VOZ;
delete process.env.TRINITY_EFFORT_VOZ;

const { abrirDb, fecharDb, guardarMemoria } = await import("../server/db.js");
const { instrucoesRealtime, opcoesModelo } = await import("../server/agente.js");

beforeAll(() => {
  abrirDb(":memory:");
});

afterAll(() => {
  fecharDb();
});

describe("modelo por canal", () => {
  it("usa o modelo configurado no texto", () => {
    expect(opcoesModelo(false)).toEqual({ modelo: "modelo-texto", esforco: "medium", iteracoes: 8 });
  });

  it("usa um modelo mais rápido e esforço baixo na voz", () => {
    expect(opcoesModelo(true)).toEqual({ modelo: "claude-sonnet-5-5", esforco: "low", iteracoes: 5 });
  });
});

describe("instruções da voz em tempo real", () => {
  it("incluem as memórias e a hora", () => {
    guardarMemoria("Prefere visitar Braga às segundas.");
    const texto = instrucoesRealtime();
    expect(texto).toContain("Prefere visitar Braga às segundas.");
    expect(texto).toContain("consultar_trinity");
    expect(texto).toMatch(/Agora: .+\d{4}/);
  });
});
