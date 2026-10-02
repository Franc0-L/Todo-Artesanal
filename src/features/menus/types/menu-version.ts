import type {
  MenuVersionItem,
  MenuVersionItemInput,
} from "./menu-version-item";

/**
 * Metadata de una versión de menú, sin composición. Se usa en
 * listados donde cargar los items de cada versión no aporta valor.
 */
export interface MenuVersionSummary {
  id: string;
  menuId: string;
  versionNumber: number;
  name: string;
  price: number;
  createdAt: string;
}

/**
 * Versión de menú con su composición completa (items + la
 * dish_version referenciada por cada uno).
 */
export interface MenuVersion extends MenuVersionSummary {
  items: MenuVersionItem[];
}

/**
 * Input para crear una nueva versión de un menú.
 *
 * items debe contener exactamente 1 item con role='main' y 0..N
 * con role='side'. La validación de "exactamente 1 main" se hace
 * en el RPC de PostgreSQL (create_menu_version), no acá.
 */
export interface CreateMenuVersionInput {
  name: string;
  price: number;
  items: MenuVersionItemInput[];
}
