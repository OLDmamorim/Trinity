// Emails da Trinity ao Marco, enviados pelo Resend a partir do noreply (o mesmo do PoweringEG).
import { config } from "./config.js";
import * as google from "./google.js";

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Texto simples para um HTML legível: parágrafos e quebras de linha. */
export function textoParaHtml(texto: string): string {
  const paragrafos = texto
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapar(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${paragrafos}</div>`;
}

/** Envia um email ao próprio Marco. */
export async function enviarEmailAoMarco(assunto: string, texto: string) {
  if (!config.resendKey) throw new Error("O envio de emails ainda não está configurado (falta RESEND_API_KEY).");
  const para = config.emailPara || (await google.emailDaConta().catch(() => null));
  if (!para) throw new Error("Não sei para que endereço enviar (falta EMAIL_PARA).");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.emailDe, to: [para], subject: assunto, text: texto, html: textoParaHtml(texto) }),
    signal: AbortSignal.timeout(20_000),
  });
  const dados = (await resp.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!resp.ok || !dados.id) throw new Error(`O envio do email falhou (${resp.status}): ${dados.message ?? "sem detalhe"}`);
  return { enviado: true, para, assunto };
}
