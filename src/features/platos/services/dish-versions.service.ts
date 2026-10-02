import { supabase } from "../../../lib/supabase";
import { runSupabase, runSupabaseOrThrow } from "../../../lib/error-handler";
import { AppError } from "../../../lib/errors";
import type { Tables } from "../../../types/database";
import type {
  CreateDishVersionInput,
  DishVersion,
} from "../types/dish-version";

type DishVersionRow = Tables<"dish_versions">;

const DISH_VERSION_COLUMNS = "id,dish_id,version_number,name,price,created_at";

export async function listDishVersions(dishId: string): Promise<DishVersion[]> {
  validateUuid(dishId, "dishId");

  const result = await runSupabase<DishVersionRow[]>(() =>
    supabase
      .from("dish_versions")
      .select(DISH_VERSION_COLUMNS)
      .eq("dish_id", dishId)
      .order("version_number", { ascending: false }),
  );

  return (result ?? []).map(mapDishVersion);
}

export async function getDishVersion(versionId: string): Promise<DishVersion> {
  validateUuid(versionId, "versionId");

  const row = await runSupabaseOrThrow<DishVersionRow>(() =>
    supabase
      .from("dish_versions")
      .select(DISH_VERSION_COLUMNS)
      .eq("id", versionId)
      .maybeSingle(),
  );

  return mapDishVersion(row);
}

/**
 * Crea una nueva versión de un plato.
 *
 * El version_number se calcula como MAX(version_number) + 1
 * para el dish_id dado.
 *
 * IMPORTANTE: hay una race condition teórica si dos clientes
 * crean versiones del mismo plato a la vez. El UNIQUE
 * (dish_id, version_number) hace que la segunda inserción
 * falle — no corrompe datos, pero el error es críptico.
 *
 * TODO: si esto se vuelve un problema real, migrar a una RPC
 * que haga el cálculo y el INSERT atómicamente.
 */
export async function createDishVersion(
  dishId: string,
  input: CreateDishVersionInput,
): Promise<DishVersion> {
  validateUuid(dishId, "dishId");
  validateCreateDishVersionInput(input);

  const existing = await runSupabase<{ version_number: number }[]>(() =>
    supabase
      .from("dish_versions")
      .select("version_number")
      .eq("dish_id", dishId)
      .order("version_number", { ascending: false })
      .limit(1),
  );

  const nextVersionNumber =
    existing && existing.length > 0 ? existing[0].version_number + 1 : 1;

  const row = await runSupabaseOrThrow<DishVersionRow>(() =>
    supabase
      .from("dish_versions")
      .insert({
        dish_id: dishId,
        version_number: nextVersionNumber,
        name: input.name.trim(),
        price: input.price,
      })
      .select(DISH_VERSION_COLUMNS)
      .single(),
  );

  return mapDishVersion(row);
}

function validateCreateDishVersionInput(input: CreateDishVersionInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Los datos de la versión son obligatorios.",
    );
  }

  if (typeof input.name !== "string" || !input.name.trim()) {
    throw new AppError(
      "VALIDATION_ERROR",
      "El nombre de la versión no puede estar vacío.",
    );
  }

  if (
    typeof input.price !== "number" ||
    !Number.isFinite(input.price) ||
    input.price < 0
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "El precio debe ser un número mayor o igual a 0.",
    );
  }
}

function validateUuid(value: string, fieldName: string): void {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${fieldName} debe ser un UUID válido.`,
    );
  }
}

function mapDishVersion(row: DishVersionRow): DishVersion {
  return {
    id: row.id,
    dishId: row.dish_id,
    versionNumber: row.version_number,
    name: row.name,
    price: row.price,
    createdAt: row.created_at,
  };
}
