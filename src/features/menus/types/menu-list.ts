export interface MenuListItem {
  id: string;
  /**
   * Nombre de la última versión del menú.
   * null si el menú no tiene versiones cargadas.
   */
  name: string | null;
  /**
   * Cantidad de ítems (main + sides) de la última versión.
   */
  itemCount: number;
  active: boolean;
  createdAt: string;
}

export interface MenuListParams {
  search?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface MenuListResult {
  items: MenuListItem[];
  total: number;
  page: number;
  pageSize: number;
}
