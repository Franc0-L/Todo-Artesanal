import { useSyncExternalStore } from "react";
import { AdminSectionPage } from "../features/admin/AdminSectionPage";
import { AdminLoginPage } from "../features/auth/AdminLoginPage";
import { useAuth } from "../features/auth/AuthProvider";
import { AdminShell } from "../features/admin/AdminShell";
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

function AdminRoute({ path }: { path: Extract<ReturnType<typeof resolveRoute>, { kind: "admin" }>['path'] }) {
  const { status, error } = useAuth();

  if (status === "loading") {
    return <main aria-busy="true">Cargando sesión…</main>;
  }

  if (status === "signed-out") {
    return <AdminLoginPage />;
  }

  if (status === "forbidden" || status === "error") {
    return (
      <main>
        <h1>No se puede acceder al área administrativa</h1>
        <p role="alert">{error ?? "Ocurrió un error al verificar la sesión."}</p>
      </main>
    );
  }

  return (
    <AdminShell currentPath={path}>
      <AdminSectionPage path={path} />
    </AdminShell>
  );
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
      return <AdminRoute path={route.path} />;
    case "client-menu":
      return <div>Menú del cliente</div>;
    case "home":
      return <div>Todo Artesanal</div>;
    case "not-found":
      return <div>Página no encontrada</div>;
  }
}
