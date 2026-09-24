import { supabase } from "../../../lib/supabase";
import { runSupabase, runSupabaseOrThrow } from "../../../lib/error-handler";
import { AppError } from "../../../lib/errors";
import type { OptionType } from "../../../types/domain";
import type { DishVersion } from "../../platos/types/dish-version";
import type { MenuVersionSummary } from "../../menus/types/menu-version";
import type {
  AddDayOptionInput,
  UpdateDayOptionInput,
  WeekDayOption,
  WeekOffer,
  WeekOfferDay,
} from "../types/week-offer";
import { listWeekDays } from "./week-days.service";

interface WeekDayOptionWithRefs {
  id: string;
  week_day_id: string;
  option_type: string;
  created_at: string;
  dish_versions: {
    id: string;
    dish_id: string;
    version_number: number;
    name: string;
    price: number;
    created_at: string;
  } | null;
  menu_versions: {
    id: string;
    menu_id: string;
    version_number: number;
    name: string;
    price: number;
    created_at: string;
  } | null;
}

const WEEK_DAY_OPTION_WITH_REFS_SELECT = `
  id,
  week_day_id,
  option_type,
  created_at,
  dish_versions (
    id,
    dish_id,
    version_number,
    name,
    price,
    created_at
  ),
  menu_versions (
    id,
    menu_id,
    version_number,
    name,
    price,
    created_at
  )
`;

export async function listDayOptions(
  weekDayId: string,
): Promise<WeekDayOption[]> {
  validateUuid(weekDayId, "weekDayId");

  const result = await runSupabase<WeekDayOptionWithRefs[]>(() =>
    supabase
      .from("week_day_options")
      .select(WEEK_DAY_OPTION_WITH_REFS_SELECT)
      .eq("week_day_id", weekDayId),
  );

  return (result ?? []).map(mapWeekDayOption);
}

/**
 * Devuelve la oferta completa de una semana: cada día con sus
 * opciones.
 *
 * Realiza 2 queries: una para los días, otra para todas las
 * opciones de esos días. Arma la agrupación en cliente.
 */
export async function getWeekOffer(weekId: string): Promise<WeekOffer> {
  validateUuid(weekId, "weekId");

  const days = await listWeekDays(weekId);

  if (days.length === 0) {
    return { weekId, days: [] };
  }

  const dayIds = days.map((d) => d.id);

  const optionsResult = await runSupabase<WeekDayOptionWithRefs[]>(() =>
    supabase
      .from("week_day_options")
      .select(WEEK_DAY_OPTION_WITH_REFS_SELECT)
      .in("week_day_id", dayIds),
  );

  const optionsByDay = new Map<string, WeekDayOption[]>();

  for (const row of optionsResult ?? []) {
    const option = mapWeekDayOption(row);
    const current = optionsByDay.get(option.weekDayId) ?? [];
    current.push(option);
    optionsByDay.set(option.weekDayId, current);
  }

  const weekDays: WeekOfferDay[] = days.map((day) => ({
    weekDay: day,
    options: optionsByDay.get(day.id) ?? [],
  }));

  return { weekId, days: weekDays };
}

/**
 * Agrega una opción a un día de la semana.
 *
 * El INSERT respeta la XOR del schema (option_type coincide con
 * uno de los dos IDs). Si el día está en una semana cerrada,
 * el trigger de protección lo rechaza.
 */
export async function addDayOption(
  input: AddDayOptionInput,
): Promise<WeekDayOption> {
  const payload = validateAddDayOptionInput(input);

  const result = await runSupabaseOrThrow<WeekDayOptionWithRefs>(() =>
    supabase
      .from("week_day_options")
      .insert(payload)
      .select(WEEK_DAY_OPTION_WITH_REFS_SELECT)
      .single(),
  );

  return mapWeekDayOption(result);
}

/**
 * Actualiza la versión referenciada por una opción.
 *
 * No permite cambiar de dish a menu ni viceversa. Si la opción
 * ya tiene pedidos asociados, el trigger de congelamiento la
 * rechaza.
 */
export async function updateDayOption(
  optionId: string,
  input: UpdateDayOptionInput,
): Promise<WeekDayOption> {
  validateUuid(optionId, "optionId");
  const payload = validateUpdateDayOptionInput(input);

  const result = await runSupabaseOrThrow<WeekDayOptionWithRefs>(() =>
    supabase
      .from("week_day_options")
      .update(payload)
      .eq("id", optionId)
      .select(WEEK_DAY_OPTION_WITH_REFS_SELECT)
      .single(),
  );

  return mapWeekDayOption(result);
}

export async function removeDayOption(optionId: string): Promise<void> {
  validateUuid(optionId, "optionId");

  await runSupabase<unknown>(() =>
    supabase.from("week_day_options").delete().eq("id", optionId),
  );
}

function validateAddDayOptionInput(input: AddDayOptionInput): {
  week_day_id: string;
  option_type: "dish" | "menu";
  dish_version_id: string | null;
  menu_version_id: string | null;
} {
  if (!input || typeof input !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Los datos de la opción son obligatorios.",
    );
  }

  validateUuid(input.weekDayId, "weekDayId");

  if (input.optionType === "dish") {
    validateUuid(input.dishVersionId, "dishVersionId");

    return {
      week_day_id: input.weekDayId,
      option_type: "dish",
      dish_version_id: input.dishVersionId,
      menu_version_id: null,
    };
  }

  if (input.optionType === "menu") {
    validateUuid(input.menuVersionId, "menuVersionId");

    return {
      week_day_id: input.weekDayId,
      option_type: "menu",
      dish_version_id: null,
      menu_version_id: input.menuVersionId,
    };
  }

  throw new AppError(
    "VALIDATION_ERROR",
    "optionType debe ser 'dish' o 'menu'.",
  );
}

function validateUpdateDayOptionInput(input: UpdateDayOptionInput): {
  option_type: "dish" | "menu";
  dish_version_id: string | null;
  menu_version_id: string | null;
} {
  if (!input || typeof input !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Los datos de la opción son obligatorios.",
    );
  }

  if (input.optionType === "dish") {
    validateUuid(input.dishVersionId, "dishVersionId");

    return {
      option_type: "dish",
      dish_version_id: input.dishVersionId,
      menu_version_id: null,
    };
  }

  if (input.optionType === "menu") {
    validateUuid(input.menuVersionId, "menuVersionId");

    return {
      option_type: "menu",
      dish_version_id: null,
      menu_version_id: input.menuVersionId,
    };
  }

  throw new AppError(
    "VALIDATION_ERROR",
    "optionType debe ser 'dish' o 'menu'.",
  );
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

function mapOptionType(value: string): OptionType {
  if (value === "dish" || value === "menu") {
    return value;
  }

  throw new AppError(
    "DATABASE_ERROR",
    `El tipo de opción almacenado es inválido: ${value}.`,
  );
}

function mapDishVersionRef(row: {
  id: string;
  dish_id: string;
  version_number: number;
  name: string;
  price: number;
  created_at: string;
}): DishVersion {
  return {
    id: row.id,
    dishId: row.dish_id,
    versionNumber: row.version_number,
    name: row.name,
    price: row.price,
    createdAt: row.created_at,
  };
}

function mapMenuVersionSummaryRef(row: {
  id: string;
  menu_id: string;
  version_number: number;
  name: string;
  price: number;
  created_at: string;
}): MenuVersionSummary {
  return {
    id: row.id,
    menuId: row.menu_id,
    versionNumber: row.version_number,
    name: row.name,
    price: row.price,
    createdAt: row.created_at,
  };
}

function mapWeekDayOption(row: WeekDayOptionWithRefs): WeekDayOption {
  return {
    id: row.id,
    weekDayId: row.week_day_id,
    optionType: mapOptionType(row.option_type),
    dishVersion: row.dish_versions
      ? mapDishVersionRef(row.dish_versions)
      : null,
    menuVersion: row.menu_versions
      ? mapMenuVersionSummaryRef(row.menu_versions)
      : null,
    createdAt: row.created_at,
  };
}
