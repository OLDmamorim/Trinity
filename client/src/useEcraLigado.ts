// Mantém o ecrã ligado enquanto `ativo` for true (Screen Wake Lock), para o telemóvel
// não adormecer a meio da conversa por voz.
import { useEffect } from "react";

export function useEcraLigado(ativo: boolean) {
  useEffect(() => {
    if (!ativo || !("wakeLock" in navigator)) return;
    let trinco: WakeLockSentinel | null = null;
    let fim = false;

    async function pedir() {
      try {
        trinco = await navigator.wakeLock.request("screen");
        if (fim) trinco.release().catch(() => {});
      } catch {
        trinco = null; // sem permissão ou poupança de bateria: segue sem trinco
      }
    }
    // O trinco cai quando a app sai do ecrã; volta a pedir-se ao regressar.
    function aoVoltar() {
      if (document.visibilityState === "visible" && (!trinco || trinco.released)) pedir();
    }

    pedir();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      fim = true;
      document.removeEventListener("visibilitychange", aoVoltar);
      trinco?.release().catch(() => {});
    };
  }, [ativo]);
}
