import type { Climate } from "../../../types/domain";

export interface DishListItem {
  id: string;
  /**
   * Nombre de la última versión del plato.
   * null si el plato no tiene versiones cargadas.
   */
  name: string | null;
  category: string | null;
  climate: Climate | null;
  active: boolean;
}

export interface DishListParams {
  search?: string;
  category?: string;
  climate?: Climate;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface DishListResult {
  items: DishListItem[];
  total: number;
  page: number;
  pageSize: number;
}
