// Ativar notificações push (briefing da manhã).
import { api } from "./api";

function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function notificacoesSuportadas(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function ativarNotificacoes(): Promise<string> {
  if (!notificacoesSuportadas()) return "Este telemóvel não suporta notificações nesta app.";
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return "As notificações ficaram bloqueadas. Podes ativá-las nas definições do Chrome.";
  const { chave } = await api.chavePush();
  if (!chave) return "As notificações ainda não estão configuradas no servidor.";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }));
  await api.subscreverPush(sub.toJSON());
  return "Notificações ativas. Recebes o briefing todas as manhãs.";
}
