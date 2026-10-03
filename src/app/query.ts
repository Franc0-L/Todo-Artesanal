import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Pequeño store reactivo para la query string, complementario al router de
 * `routes.ts` (que sigue la ruta). Comparte el evento `popstate`, así que
 * navegar entre rutas con `navigate()` también refresca los params.
 */
const listeners = new Set<() => void>();

function emitLocationChange(): void {
  for (const listener of listeners) listener();
}

function subscribeToQuery(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("popstate", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("popstate", callback);
  };
}

function getSearch(): string {
  return window.location.search;
}

function getServerSearch(): string {
  return "";
}

/** Query params de la ruta actual, reactivos al historial (back/forward). */
export function useSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(
    subscribeToQuery,
    getSearch,
    getServerSearch,
  );

  return useMemo(() => new URLSearchParams(search), [search]);
}

/** Valor de un query param como string, o `null` si no está presente. */
export function useQueryParam(key: string): string | null {
  return useSearchParams().get(key);
}

/**
 * Actualiza los query params de la ruta actual. Un valor `null` o `""`
 * elimina la clave. Por defecto agrega una entrada al historial; con
 * `{ replace: true }` reemplaza la actual (útil para normalizar valores).
 */
export function setSearchParams(
  updates: Record<string, string | null>,
  options?: { replace?: boolean },
): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;

  if (options?.replace) window.history.replaceState({}, "", next);
  else window.history.pushState({}, "", next);

  emitLocationChange();
}

/**
 * Estado respaldado por la URL para un query param. El setter mantiene el
 * valor por defecto "limpio" (sin clave en la URL) y agrega historial.
 */
export function useQueryParamState(
  key: string,
  defaultValue = "",
): [string, (value: string) => void] {
  const params = useSearchParams();
  const value = params.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      setSearchParams({ [key]: next === defaultValue ? null : next });
    },
    [key, defaultValue],
  );

  return [value, setValue];
}
