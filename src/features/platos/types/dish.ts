import type { Climate } from "../../../types/domain";

export interface Dish {
  id: string;
  category: string | null;
  climate: Climate | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para crear un plato.
 *
 * Crea la identidad del plato y su primera versión en una
 * sola operación (rollback manual si falla la segunda parte).
 *
 * name y price pertenecen a la versión 1.
 * category y climate pertenecen al plato (no se versionan).
 */
export interface CreateDishInput {
  name: string;
  price: number;
  category?: string | null;
  climate?: Climate | null;
  active?: boolean;
}

/**
 * Input para actualizar atributos de la identidad del plato.
 *
 * NO incluye name ni price: esos van por nueva versión
 * (createDishVersion).
 */
export interface UpdateDishInput {
  category?: string | null;
  climate?: Climate | null;
}
