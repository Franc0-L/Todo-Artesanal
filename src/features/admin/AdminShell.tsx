import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { AdminNavigation } from "./AdminNavigation";
import type { AdminRoutePath } from "../../app/routes";

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

  return (
    <div>
      <header>
        <div>
          <strong>Todo Artesanal</strong>
          <span>Administración</span>
        </div>

        <div>
          <span>{user?.email ?? "Administrador"}</span>
          <button type="button" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <AdminNavigation currentPath={currentPath} />
      <main>{children}</main>
    </div>
  );
}
