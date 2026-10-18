import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as db from "../server/db.js";

beforeAll(() => db.abrirDb(":memory:"));
afterAll(() => db.fecharDb());

describe("base de dados", () => {
  it("devolve as últimas mensagens por ordem", () => {
    for (let i = 1; i <= 5; i++) db.guardarMensagem(i % 2 ? "user" : "assistant", `m${i}`);
    expect(db.ultimasMensagens(3).map((m) => m.texto)).toEqual(["m3", "m4", "m5"]);
  });

  it("guarda e apaga memórias", () => {
    const m = db.guardarMemoria("Prefere visitas de manhã");
    expect(db.listarMemorias()).toHaveLength(1);
    expect(db.apagarMemoria(m.id)).toBe(true);
    expect(db.apagarMemoria(m.id)).toBe(false);
  });
});

describe("segredos", () => {
  it("gera uma vez e devolve sempre o mesmo", () => {
    let chamadas = 0;
    const gerar = () => `valor-${++chamadas}`;
    expect(db.segredo("teste", gerar)).toBe("valor-1");
    expect(db.segredo("teste", gerar)).toBe("valor-1");
    expect(chamadas).toBe(1);
  });
});
