import { describe, expect, it, vi } from "vitest";
import { erroParaUtilizador } from "../server/app";

describe("erroParaUtilizador", () => {
  it("explica quando a conta da Anthropic está sem créditos", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const e = new Error(
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
    );
    expect(erroParaUtilizador(e)).toMatch(/sem créditos/);
  });
});
