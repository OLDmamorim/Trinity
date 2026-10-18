// Briefing da manhã: gerado à hora marcada, guardado e enviado como notificação.
import cron from "node-cron";
import { config } from "./config.js";
import { diaLisboa } from "./datas.js";
import * as db from "./db.js";
import { gerarTextoBriefing } from "./agente.js";
import { enviarATodos } from "./push.js";

export async function gerarBriefing(notificar: boolean): Promise<db.Briefing> {
  const texto = await gerarTextoBriefing();
  const briefing = db.guardarBriefing(diaLisboa(), texto);
  if (notificar) {
    const primeiraLinha = texto.split("\n").find((l) => l.trim())?.replace(/[#*_]/g, "").trim() ?? "O teu dia está pronto.";
    await enviarATodos("Bom dia, Marco", primeiraLinha.slice(0, 140), "/");
  }
  return briefing;
}

export function agendarBriefing() {
  if (!cron.validate(config.briefingCron)) {
    console.error(`[briefing] BRIEFING_CRON inválido: "${config.briefingCron}"`);
    return;
  }
  cron.schedule(
    config.briefingCron,
    () => {
      gerarBriefing(true).catch((e) => console.error("[briefing] falhou:", e));
    },
    { timezone: config.fusoHorario },
  );
  console.log(`[briefing] agendado: "${config.briefingCron}" (${config.fusoHorario})`);
}
