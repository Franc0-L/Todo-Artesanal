import { useSyncExternalStore } from "react";
import { resolveRoute } from "./routes";

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function getLocation() {
  return window.location.pathname;
}

function getServerLocation() {
  return "/";
}

export function AppRouter() {
  const pathname = useSyncExternalStore(
    subscribeToLocation,
    getLocation,
    getServerLocation,
  );
  const route = resolveRoute(pathname);

  switch (route.kind) {
    case "admin":
      return <div>Área administrativa</div>;
    case "client-menu":
      return <div>Menú del cliente</div>;
    case "home":
      return <div>Todo Artesanal</div>;
    case "not-found":
      return <div>Página no encontrada</div>;
  }
}
