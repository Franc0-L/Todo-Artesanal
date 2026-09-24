import { supabase } from "../../../lib/supabase";
import {
  runSupabase,
  runSupabaseFull,
  runSupabaseOrThrow,
} from "../../../lib/error-handler";
import { AppError } from "../../../lib/errors";
import type { Tables } from "../../../types/database";
import type {
  CreateMenuInput,
  Menu,
  MenuWithCurrentVersion,
} from "../types/menu";
import type {
  MenuListItem,
  MenuListParams,
  MenuListResult,
} from "../types/menu-list";
import type { MenuVersionItemInput } from "../types/menu-version-item";
import { getLatestMenuVersion } from "./menu-versions.service";

type MenuRow = Tables<"menus">;
type MenuVersionRow = Tables<"menu_versions">;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const MENU_COLUMNS = "id,active,created_at,updated_at";
const MENU_LIST_COLUMNS = "id,active,created_at";

export async function listMenus(
  params: MenuListParams = {},
): Promise<MenuListResult> {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const search = normalizeSearch(params.search);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Igual que en dishes.service.ts: si hay búsqueda por nombre,
  // primero resolvemos los menu_id que matcheen por nombre en
  // cualquier versión.
  //
  // TODO: si el catálogo crece mucho, este `.in()` puede romper por
  // límite de URL. Migrar a vista o RPC.
  let menuIdsFilter: string[] | undefined;

  if (search) {
    const escaped = escapeIlikePattern(search);

    const matches = await runSupabase<{ menu_id: string }[]>(() =>
      supabase
        .from("menu_versions")
        .select("menu_id")
        .ilike("name", `%${escaped}%`),
    );

    menuIdsFilter = [...new Set((matches ?? []).map((m) => m.menu_id))];

    if (menuIdsFilter.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }
  }

  let query = supabase
    .from("menus")
    .select(MENU_LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.active !== undefined) {
    query = query.eq("active", params.active);
  }

  if (menuIdsFilter) {
    query = query.in("id", menuIdsFilter);
  }

  const menuResult = await runSupabaseFull<
    Pick<MenuRow, "id" | "active" | "created_at">[]
  >(() => query);

  const menus = menuResult.data ?? [];
  const total = menuResult.count ?? 0;

  if (menus.length === 0) {
    return { items: [], total, page, pageSize };
  }

  const menuIds = menus.map((m) => m.id);

  // Última versión por menú (misma técnica que dishes.service.ts).
  const versionsResult = await runSupabase<
    Pick<MenuVersionRow, "id" | "menu_id" | "name" | "version_number">[]
  >(() =>
    supabase
      .from("menu_versions")
      .select("id,menu_id,name,version_number")
      .in("menu_id", menuIds),
  );

  const latestByMenu = new Map<
    string,
    { versionId: string; name: string; versionNumber: number }
  >();

  for (const v of versionsResult ?? []) {
    const current = latestByMenu.get(v.menu_id);

    if (!current || v.version_number > current.versionNumber) {
      latestByMenu.set(v.menu_id, {
        versionId: v.id,
        name: v.name,
        versionNumber: v.version_number,
      });
    }
  }

  // Cantidad de ítems de la última versión de cada menú. Agregación
  // en cliente, igual que en dish-usage.service.ts.
  //
  // TODO: si el volumen de menu_version_items crece, migrar a vista
  // o RPC con agregación en PostgreSQL.
  const latestVersionIds = [...latestByMenu.values()].map((v) => v.versionId);

  const itemCountByVersion = new Map<string, number>();

  if (latestVersionIds.length > 0) {
    const itemsResult = await runSupabase<{ menu_version_id: string }[]>(() =>
      supabase
        .from("menu_version_items")
        .select("menu_version_id")
        .in("menu_version_id", latestVersionIds),
    );

    for (const item of itemsResult ?? []) {
      itemCountByVersion.set(
        item.menu_version_id,
        (itemCountByVersion.get(item.menu_version_id) ?? 0) + 1,
      );
    }
  }

  const items: MenuListItem[] = menus.map((m) => {
    const latest = latestByMenu.get(m.id);

    return {
      id: m.id,
      name: latest?.name ?? null,
      itemCount: latest ? (itemCountByVersion.get(latest.versionId) ?? 0) : 0,
      active: m.active,
      createdAt: m.created_at,
    };
  });

  return { items, total, page, pageSize };
}

export async function getMenu(menuId: string): Promise<MenuWithCurrentVersion> {
  validateUuid(menuId, "menuId");

  const row = await runSupabaseOrThrow<MenuRow>(() =>
    supabase.from("menus").select(MENU_COLUMNS).eq("id", menuId).maybeSingle(),
  );

  const currentVersion = await getLatestMenuVersion(menuId);

  return {
    ...mapMenu(row),
    currentVersion,
  };
}

/**
 * Crea un menú (identidad + versión 1 + composición) mediante el
 * RPC create_menu, que hace todo en una única transacción de
 * PostgreSQL.
 *
 * No hay rollback manual acá: si el RPC lanza una excepción, la
 * transacción de Postgres ya revirtió todo (identidad, versión e
 * items). El error llega como AppError("BUSINESS_RULE", ...) vía
 * el mapeo de P0001 en error-handler.ts.
 *
 * Validación en TS: solo forma/tipo (nombre no vacío, precio >= 0,
 * items no vacío, cada dishVersionId con forma de UUID, role en
 * {main,side}). La regla de negocio "exactamente 1 main" y "sin
 * dish_version_id repetidos" NO se duplica acá — vive únicamente
 * en el RPC.
 */
export async function createMenu(
  input: CreateMenuInput,
): Promise<MenuWithCurrentVersion> {
  const payload = validateCreateMenuInput(input);

  const menuId = await runSupabaseOrThrow<string>(() =>
    supabase.rpc("create_menu", {
      p_name: payload.name,
      p_price: payload.price,
      p_items: payload.items,
      p_active: payload.active,
    }),
  );

  return getMenu(menuId);
}

export async function setMenuActive(
  menuId: string,
  active: boolean,
): Promise<Menu> {
  validateUuid(menuId, "menuId");

  if (typeof active !== "boolean") {
    throw new AppError(
      "VALIDATION_ERROR",
      "El estado activo debe ser booleano.",
    );
  }

  const row = await runSupabaseOrThrow<MenuRow>(() =>
    supabase
      .from("menus")
      .update({ active })
      .eq("id", menuId)
      .select(MENU_COLUMNS)
      .single(),
  );

  return mapMenu(row);
}

/**
 * Elimina definitivamente un menú.
 *
 * ADVERTENCIA: falla con FK violation si el menú tiene versiones
 * asociadas, porque menu_versions no tiene ON DELETE CASCADE y las
 * versiones son inmutables (no se pueden borrar para despejar el
 * camino). En la práctica, cualquier menú creado con createMenu (que
 * crea una versión) NO se puede eliminar. Usar setMenuActive(id,
 * false) para retirarlo del catálogo.
 */
export async function deleteMenu(menuId: string): Promise<void> {
  validateUuid(menuId, "menuId");

  await runSupabase<unknown>(() =>
    supabase.from("menus").delete().eq("id", menuId),
  );
}

function validateCreateMenuInput(input: CreateMenuInput): {
  name: string;
  price: number;
  items: { dish_version_id: string; role: string }[];
  active: boolean;
} {
  if (!input || typeof input !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Los datos del menú son obligatorios.",
    );
  }

  const name = normalizeRequiredString(input.name, "name");
  const price = normalizePrice(input.price);
  const items = validateMenuItemsInput(input.items);

  return {
    name,
    price,
    items,
    active: input.active ?? true,
  };
}

function validateMenuItemsInput(
  items: MenuVersionItemInput[],
): { dish_version_id: string; role: string }[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "El menú debe tener al menos un ítem (el plato principal).",
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

function normalizeSearch(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError("VALIDATION_ERROR", "La búsqueda debe ser texto.");
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function normalizePage(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_PAGE;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new AppError(
      "VALIDATION_ERROR",
      "page debe ser un entero mayor o igual a 1.",
    );
  }

  return value;
}

function normalizePageSize(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_PAGE_SIZE;
  }

  if (!Number.isInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    throw new AppError(
      "VALIDATION_ERROR",
      `pageSize debe ser un entero entre 1 y ${MAX_PAGE_SIZE}.`,
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

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function mapMenu(row: MenuRow): Menu {
  return {
    id: row.id,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
