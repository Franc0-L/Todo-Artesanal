import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { AdminNavigation } from "./AdminNavigation";
import { navigate, type AdminRoutePath } from "../../app/routes";
import "./admin-shell.css";

export function AdminShell({
  children,
  currentPath,
}: {
  children: ReactNode;
  currentPath: AdminRoutePath;
}) {
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      console.error("No se pudo cerrar sesión:", error);
    }
  }

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "A";

  return (
    <div className="admin-shell">
      <header className="admin-shell__header">
        <div className="admin-shell__header-inner">
          <button
            type="button"
            className="admin-shell__brand"
            onClick={() => navigate("/admin")}
            aria-label="Ir al panel de inicio"
          >
            <div className="admin-shell__brand-logo" aria-hidden="true">
              TA
            </div>
            <div className="admin-shell__brand-text">
              <strong className="admin-shell__brand-name">
                Todo Artesanal
              </strong>
              <span className="admin-shell__brand-badge">Admin</span>
            </div>
          </button>

          <div className="admin-shell__user">
            <div
              className="admin-shell__user-info"
              title={user?.email ?? undefined}
            >
              <div className="admin-shell__user-avatar" aria-hidden="true">
                {userInitial}
              </div>
              <span>{user?.email ?? "Administrador"}</span>
            </div>
            <button
              type="button"
              className="admin-shell__signout-btn"
              onClick={handleSignOut}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <AdminNavigation currentPath={currentPath} />
      <main className="admin-shell__main">{children}</main>
    </div>
  );
}
