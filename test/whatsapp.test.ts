import { describe, expect, it } from "vitest";
import { linkWhatsApp, normalizarNumero } from "../server/whatsapp.js";

describe("whatsapp", () => {
  it("normaliza números portugueses e internacionais", () => {
    expect(normalizarNumero("912 345 678")).toBe("351912345678");
    expect(normalizarNumero("+351 912-345-678")).toBe("351912345678");
    expect(normalizarNumero("00351912345678")).toBe("351912345678");
    expect(normalizarNumero("+34 612 345 678")).toBe("34612345678");
    expect(normalizarNumero("123")).toBeNull();
  });

  it("monta o link com e sem número", () => {
    expect(linkWhatsApp("Chego às 10h", "912345678").link).toBe("https://wa.me/351912345678?text=Chego%20%C3%A0s%2010h");
    expect(linkWhatsApp("Olá")).toEqual({ link: "https://wa.me/?text=Ol%C3%A1", comNumero: false });
    expect(() => linkWhatsApp("Olá", "12")).toThrow();
  });
});
