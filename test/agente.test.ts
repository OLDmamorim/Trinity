import { describe, expect, it } from "vitest";

process.env.TRINITY_MODEL = "modelo-texto";
process.env.TRINITY_EFFORT = "medium";
delete process.env.TRINITY_MODEL_VOZ;
delete process.env.TRINITY_EFFORT_VOZ;

const { opcoesModelo } = await import("../server/agente.js");

describe("modelo por canal", () => {
  it("usa o modelo configurado no texto", () => {
    expect(opcoesModelo(false)).toEqual({ modelo: "modelo-texto", esforco: "medium", iteracoes: 8 });
  });

  it("usa um modelo mais rápido e esforço baixo na voz", () => {
    expect(opcoesModelo(true)).toEqual({ modelo: "claude-sonnet-5-5", esforco: "low", iteracoes: 5 });
  });
});
