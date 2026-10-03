import { RouteLink } from "../../app/RouteLink";
import type { AdminRoutePath } from "../../app/routes";
import type { MascotAsset } from "../../components/ui/EmptyState";

interface AdminNavItem {
  path: AdminRoutePath;
  label: string;
  /** Ícono de la mascota, servido desde `public/mascot/<icon>.png`. */
  icon: MascotAsset;
}

const items: AdminNavItem[] = [
  { path: "/admin", label: "Inicio", icon: "icon_gorro" },
  { path: "/admin/clientes", label: "Clientes", icon: "icon_cafe" },
  { path: "/admin/platos", label: "Platos", icon: "icon_batidor" },
  { path: "/admin/menus", label: "Menús", icon: "icon_cubiertos" },
  { path: "/admin/semanas", label: "Semanas", icon: "icon_espatula" },
  { path: "/admin/pedidos", label: "Pedidos", icon: "icon_pedir" },
  { path: "/admin/cancelaciones", label: "Cancelaciones", icon: "icon_chef" },
  { path: "/admin/historial", label: "Historial", icon: "icon_campana" },
  { path: "/admin/reportes", label: "Reportes", icon: "degustacion" },
];

export function AdminNavigation({
  currentPath,
}: {
  currentPath: AdminRoutePath;
}) {
  return (
    <nav className="admin-nav" aria-label="Navegación administrativa">
      <div className="admin-nav__inner">
        <ul className="admin-nav__list">
          {items.map((item) => {
            const isCurrent = item.path === currentPath;

            return (
              <li key={item.path} className="admin-nav__item">
                <RouteLink
                  className="admin-nav__button"
                  to={item.path}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  <img
                    className="admin-nav__icon"
                    src={`/mascot/${item.icon}.png`}
                    alt=""
                    aria-hidden="true"
                    width="22"
                    height="22"
                    decoding="async"
                  />
                  {item.label}
                </RouteLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
