import { navigate, type AdminRoutePath } from "../../app/routes";

const items: Array<{ path: AdminRoutePath; label: string }> = [
  { path: "/admin", label: "Inicio" },
  { path: "/admin/clientes", label: "Clientes" },
  { path: "/admin/platos", label: "Platos" },
  { path: "/admin/menus", label: "Menús" },
  { path: "/admin/semanas", label: "Semanas" },
  { path: "/admin/pedidos", label: "Pedidos" },
  { path: "/admin/historial", label: "Historial" },
];

export function AdminNavigation({ currentPath }: { currentPath: AdminRoutePath }) {
  return (
    <nav aria-label="Navegación administrativa">
      <ul>
        {items.map((item) => {
          const isCurrent = item.path === currentPath;

          return (
            <li key={item.path}>
              <button
                type="button"
                aria-current={isCurrent ? "page" : undefined}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
