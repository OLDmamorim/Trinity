import { describe, expect, it } from "vitest";
import { descreverTempo } from "../server/tempo.js";

describe("descreverTempo", () => {
  it("traduz os códigos WMO", () => {
    expect(descreverTempo(0)).toBe("céu limpo");
    expect(descreverTempo(63)).toBe("chuva");
    expect(descreverTempo(null)).toBe("sem dados");
    expect(descreverTempo(42)).toBe("código 42");
  });
});
