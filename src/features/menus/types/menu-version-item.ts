import type { MenuItemRole } from "../../../types/domain";

/**
 * Item de la composición de una versión de menú, enriquecido con
 * los datos de la dish_version referenciada (inmutable).
 */
export interface MenuVersionItem {
  id: string;
  menuVersionId: string;
  role: MenuItemRole;
  createdAt: string;
  dishVersion: {
    id: string;
    dishId: string;
    versionNumber: number;
    name: string;
    price: number;
  };
}

/**
 * Input para un item al crear una versión de menú (o la versión 1
 * junto con la identidad, en createMenu).
 *
 * dishVersionId debe referenciar una dish_version existente.
 */
export interface MenuVersionItemInput {
  dishVersionId: string;
  role: MenuItemRole;
}
