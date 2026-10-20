import { describe, expect, it } from "vitest";
import { textoParaHtml } from "../server/email.js";

describe("textoParaHtml", () => {
  it("faz parágrafos e escapa HTML", () => {
    const html = textoParaHtml("Olá <Marco>\nlinha 2\n\nSegundo & último");
    expect(html).toContain("Olá &lt;Marco&gt;<br>linha 2</p>");
    expect(html).toContain("Segundo &amp; último</p>");
  });
});
