import { describe, expect, it } from "vitest";
import { textoParaFalar } from "../server/voz.js";

describe("textoParaFalar", () => {
  it("tira markdown e links", () => {
    expect(textoParaFalar("**Olá**, vê [aqui](https://wa.me/351912345678) ou https://x.pt\n- Viana SM")).toBe("Olá, vê aqui ou \nViana SM");
  });
});
