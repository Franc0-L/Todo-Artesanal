import type { AdminRoutePath, AppRoute } from "./routes";

/** Nombre de la aplicación, usado como sufijo del título del documento. */
export const APP_NAME = "Todo Artesanal";

/**
 * Etiqueta legible de cada sección administrativa. Es la fuente única para el
 * `<title>` de la pestaña; la navegación (`AdminNavigation`) mantiene su propio
 * listado con íconos, pero reusa estas etiquetas para no divergir.
 */
export const ADMIN_SECTION_LABELS: Record<AdminRoutePath, string> = {
  "/admin": "Panel de Inicio",
  "/admin/clientes": "Clientes",
  "/admin/platos": "Platos",
  "/admin/menus": "Menús",
  "/admin/semanas": "Semanas",
  "/admin/pedidos": "Pedidos",
  "/admin/cancelaciones": "Cancelaciones",
  "/admin/historial": "Historial",
  "/admin/reportes": "Reportes",
};

/** Título del documento (`document.title`) para cada ruta de la app. */
export function titleForRoute(route: AppRoute): string {
  switch (route.kind) {
    case "home":
      return APP_NAME;
    case "client-menu":
      return `Tu menú semanal · ${APP_NAME}`;
    case "admin":
      return `${ADMIN_SECTION_LABELS[route.path]} · Admin · ${APP_NAME}`;
    case "not-found":
      return `Página no encontrada · ${APP_NAME}`;
  }
}
