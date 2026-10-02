import { supabase } from "../../../lib/supabase";
import { runSupabase, runSupabaseOrThrow } from "../../../lib/error-handler";
import { AppError } from "../../../lib/errors";
import type { Tables } from "../../../types/database";
import type { MenuItemRole } from "../../../types/domain";
import type {
  CreateMenuVersionInput,
  MenuVersion,
  MenuVersionSummary,
} from "../types/menu-version";
import type {
  MenuVersionItem,
  MenuVersionItemInput,
} from "../types/menu-version-item";

type MenuVersionRow = Tables<"menu_versions">;

const MENU_VERSION_COLUMNS = "id,menu_id,version_number,name,price,created_at";

interface MenuVersionItemWithDish {
  id: string;
  menu_version_id: string;
  role: string;
  created_at: string;
  dish_versions: {
    id: string;
    dish_id: string;
    version_number: number;
    name: string;
    price: number;
  } | null;
}

export async function listMenuVersions(
  menuId: string,
): Promise<MenuVersionSummary[]> {
  validateUuid(menuId, "menuId");

  const result = await runSupabase<MenuVersionRow[]>(() =>
    supabase
      .from("menu_versions")
      .select(MENU_VERSION_COLUMNS)
      .eq("menu_id", menuId)
      .order("version_number", { ascending: false }),
  );

  return (result ?? []).map(mapMenuVersionSummary);
}

export async function getMenuVersion(versionId: string): Promise<MenuVersion> {
  validateUuid(versionId, "versionId");

  const row = await runSupabaseOrThrow<MenuVersionRow>(() =>
    supabase
      .from("menu_versions")
      .select(MENU_VERSION_COLUMNS)
      .eq("id", versionId)
      .maybeSingle(),
  );

  const items = await loadMenuVersionItems(row.id);

  return mapMenuVersion(row, items);
}

/**
 * Devuelve la versión de mayor version_number para un menú, con su
 * composición completa.
 *
 * Devuelve null si el menú no tiene ninguna versión cargada (estado
 * transitorio/inconsistente: createMenu siempre crea identidad +
 * versión 1 juntas mediante el RPC create_menu).
 */
export async function getLatestMenuVersion(
  menuId: string,
): Promise<MenuVersion | null> {
  validateUuid(menuId, "menuId");

  const row = await findLatestMenuVersionRow(menuId);

  if (!row) {
    return null;
  }

  const items = await loadMenuVersionItems(row.id);

  return mapMenuVersion(row, items);
}

/**
 * Crea una nueva versión para un menú existente mediante el RPC
 * create_menu_version, que calcula MAX(version_number) + 1 e
 * inserta la versión + composición en una única transacción.
 *
 * No hay rollback manual acá: si el RPC lanza una excepción, la
 * transacción de Postgres ya revirtió todo. Ver la nota equivalente
 * en createMenu (menus.service.ts).
 */
export async function createMenuVersion(
  menuId: string,
  input: CreateMenuVersionInput,
): Promise<MenuVersion> {
  validateUuid(menuId, "menuId");

  const payload = validateCreateMenuVersionInput(input);

  const menuVersionId = await runSupabaseOrThrow<string>(() =>
    supabase.rpc("create_menu_version", {
      p_menu_id: menuId,
      p_name: payload.name,
      p_price: payload.price,
      p_items: payload.items,
    }),
  );

  return getMenuVersion(menuVersionId);
}

async function findLatestMenuVersionRow(
  menuId: string,
): Promise<MenuVersionRow | null> {
  const versions = await runSupabase<MenuVersionRow[]>(() =>
    supabase
      .from("menu_versions")
      .select(MENU_VERSION_COLUMNS)
      .eq("menu_id", menuId)
      .order("version_number", { ascending: false })
      .limit(1),
  );

  return versions?.[0] ?? null;
}

/**
 * Carga la composición de una versión, enriquecida con los datos de
 * la dish_version referenciada por cada item (name, price, etc.).
 */
async function loadMenuVersionItems(
  versionId: string,
): Promise<MenuVersionItem[]> {
  const result = await runSupabase<MenuVersionItemWithDish[]>(() =>
    supabase
      .from("menu_version_items")
      .select(
        `
          id,
          menu_version_id,
          role,
          created_at,
          dish_versions (
            id,
            dish_id,
            version_number,
            name,
            price
          )
        `,
      )
      .eq("menu_version_id", versionId),
  );

  return (result ?? []).map(mapMenuVersionItem);
}

function validateCreateMenuVersionInput(input: CreateMenuVersionInput): {
  name: string;
  price: number;
  items: { dish_version_id: string; role: string }[];
} {
  if (!input || typeof input !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Los datos de la versión son obligatorios.",
    );
  }

  const name = normalizeRequiredString(input.name, "name");
  const price = normalizePrice(input.price);
  const items = validateMenuItemsInput(input.items);

  return { name, price, items };
}

function validateMenuItemsInput(
  items: MenuVersionItemInput[],
): { dish_version_id: string; role: string }[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "La versión debe tener al menos un ítem (el plato principal).",
    );
  }

  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new AppError(
        "VALIDATION_ERROR",
        `El ítem en la posición ${index} es inválido.`,
      );
    }

    validateUuid(item.dishVersionId, `items[${index}].dishVersionId`);

    if (item.role !== "main" && item.role !== "side") {
      throw new AppError(
        "VALIDATION_ERROR",
        `items[${index}].role debe ser "main" o "side".`,
      );
    }

    return {
      dish_version_id: item.dishVersionId,
      role: item.role,
    };
  });
}

function normalizeRequiredString(value: string, fieldName: string): string {
  if (typeof value !== "string") {
    throw new AppError("VALIDATION_ERROR", `${fieldName} debe ser texto.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${fieldName} no puede estar vacío.`,
    );
  }

  return normalized;
}

function normalizePrice(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "El precio debe ser un número mayor o igual a 0.",
    );
  }

  return value;
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

function mapMenuVersionSummary(row: MenuVersionRow): MenuVersionSummary {
  return {
    id: row.id,
    menuId: row.menu_id,
    versionNumber: row.version_number,
    name: row.name,
    price: row.price,
    createdAt: row.created_at,
  };
}

function mapMenuVersion(
  row: MenuVersionRow,
  items: MenuVersionItem[],
): MenuVersion {
  return {
    ...mapMenuVersionSummary(row),
    items,
  };
}

function mapMenuVersionItem(row: MenuVersionItemWithDish): MenuVersionItem {
  if (!row.dish_versions) {
    throw new AppError(
      "DATABASE_ERROR",
      `El item ${row.id} no tiene una dish_version asociada.`,
    );
  }

  return {
    id: row.id,
    menuVersionId: row.menu_version_id,
    role: mapMenuItemRole(row.role),
    createdAt: row.created_at,
    dishVersion: {
      id: row.dish_versions.id,
      dishId: row.dish_versions.dish_id,
      versionNumber: row.dish_versions.version_number,
      name: row.dish_versions.name,
      price: row.dish_versions.price,
    },
  };
}

function mapMenuItemRole(value: string): MenuItemRole {
  if (value === "main" || value === "side") {
    return value;
  }

  throw new AppError(
    "DATABASE_ERROR",
    `El rol almacenado es inválido: ${value}.`,
  );
}
