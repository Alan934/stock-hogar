"use client";

import { useSyncExternalStore } from "react";

/** No hay nada a lo que suscribirse: sólo nos interesa servidor vs. navegador. */
const noSubscribe = () => () => {};

/** `false` mientras se renderiza en el servidor, `true` ya en el navegador. */
export function useIsMounted() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

/** Origen actual (`http://192.168.0.10:3000`), vacío durante el render del servidor. */
export function useOrigin() {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
}
