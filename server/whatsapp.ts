// WhatsApp: a Trinity não envia nada sozinha. Prepara o link que abre o WhatsApp
// com a mensagem já escrita, e o Marco toca em enviar.

/** Normaliza um número para o formato do wa.me (só dígitos, com indicativo). Números de 9 dígitos são de Portugal. */
export function normalizarNumero(numero: string): string | null {
  let d = numero.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  d = d.replace(/\D/g, "");
  if (/^[29]\d{8}$/.test(d)) d = `351${d}`;
  return /^\d{10,15}$/.test(d) ? d : null;
}

export function linkWhatsApp(mensagem: string, numero?: string) {
  const texto = encodeURIComponent(mensagem.trim());
  if (numero) {
    const n = normalizarNumero(numero);
    if (!n) throw new Error(`O número "${numero}" não parece válido.`);
    return { link: `https://wa.me/${n}?text=${texto}`, comNumero: true };
  }
  // Sem número, o WhatsApp abre e pede para escolher a conversa.
  return { link: `https://wa.me/?text=${texto}`, comNumero: false };
}
