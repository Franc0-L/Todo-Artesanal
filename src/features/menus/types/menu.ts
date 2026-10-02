import type { MenuVersion } from "./menu-version";
import type { MenuVersionItemInput } from "./menu-version-item";

export interface Menu {
  id: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Identidad de un menú junto con su versión actual (la de mayor
 * version_number), incluyendo su composición completa.
 *
 * currentVersion es null solo en un estado transitorio/inconsistente:
 * un menú creado por createMenu siempre tiene al menos la versión 1.
 */
export interface MenuWithCurrentVersion extends Menu {
  currentVersion: MenuVersion | null;
}

/**
 * Input para crear un menú.
 *
 * Crea la identidad del menú y su primera versión (con composición)
 * en una sola operación mediante el RPC create_menu.
 *
 * name, price e items pertenecen a la versión 1.
 */
export interface CreateMenuInput {
  name: string;
  price: number;
  items: MenuVersionItemInput[];
  active?: boolean;
}
