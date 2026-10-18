// Notificações push (Web Push com chaves VAPID).
import webpush from "web-push";
import { config } from "./config.js";
import * as db from "./db.js";

let pronto = false;
function preparar(): boolean {
  if (pronto) return true;
  if (!config.vapidPublica || !config.vapidPrivada) return false;
  webpush.setVapidDetails(config.vapidContacto, config.vapidPublica, config.vapidPrivada);
  pronto = true;
  return true;
}

export function chavePublica(): string {
  return config.vapidPublica;
}

export async function enviarATodos(titulo: string, corpo: string, url = "/") {
  if (!preparar()) return { enviadas: 0 };
  let enviadas = 0;
  for (const s of db.listarSubscricoes()) {
    try {
      await webpush.sendNotification(JSON.parse(s.dados), JSON.stringify({ titulo, corpo, url }));
      enviadas++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // 404/410: a subscrição deixou de existir (app desinstalada ou permissão retirada).
      if (status === 404 || status === 410) db.apagarSubscricao(s.endpoint);
      else console.error("[push] falhou:", e);
    }
  }
  return { enviadas };
}
