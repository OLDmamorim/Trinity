// Datas sempre na hora de Lisboa.
const FUSO = "Europe/Lisbon";

export function diaLisboa(data = new Date()): string {
  // en-CA dá o formato AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(data);
}

export function agoraPorExtenso(data = new Date()): string {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: FUSO,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}
