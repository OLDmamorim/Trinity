import { useEffect, useState } from "react";
import { aoMudarFala } from "./fala";

/** true enquanto a Trinity está a ler uma resposta em voz alta. */
export function useFalando(): boolean {
  const [falando, setFalando] = useState(false);
  useEffect(() => aoMudarFala(setFalando), []);
  return falando;
}
