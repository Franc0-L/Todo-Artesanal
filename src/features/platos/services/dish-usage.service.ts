import { supabase } from "../../../lib/supabase";
import { runSupabase } from "../../../lib/error-handler";
import { AppError } from "../../../lib/errors";
import type { Climate } from "../../../types/domain";
import type {
  DishSuggestionItem,
  DishSuggestionParams,
  DishUsage,
  DishUsageParams,
  RecentDishUsageItem,
  RecentDishUsageParams,
} from "../types/dish-usage";

interface DishVersionWithOptions {
  id: string;
  dish_id: string;
  week_day_options:
    | {
        id: string;
        week_days: { date: string } | null;
      }[]
    | null;
}

interface WeekDayOptionWithRefs {
  id: string;
  week_days: { date: string } | null;
  dish_versions: { dish_id: string } | null;
}

/**
 * Obtiene información agregada de uso de un plato.
 *
 * "Uso" = cantidad de veces que el plato fue ofrecido
 * directamente en la oferta de un día (week_day_options con
 * option_type='dish').
 *
 * TODO: no cuenta usos indirectos (plato dentro de un menú
 * ofrecido). Si en el futuro hace falta, migrar a una vista o
 * RPC que unifique ambos casos.
 *
 * TODO: para catálogos grandes, migrar a una vista o RPC con
 * agregación en PostgreSQL.
 */
export async function getDishUsage(
  dishId: string,
  params: DishUsageParams = {},
): Promise<DishUsage> {
  validateUuid(dishId, "dishId");

  const versions = await runSupabase<DishVersionWithOptions[]>(() =>
    supabase
      .from("dish_versions")
      .select(
        `
          id,
          dish_id,
          week_day_options (
            id,
            week_days ( date )
          )
        `,
      )
      .eq("dish_id", dishId),
  );

  let totalUses = 0;
  let lastUsedAt: string | null = null;

  for (const version of versions ?? []) {
    for (const option of version.week_day_options ?? []) {
      const date = option.week_days?.date ?? null;

      if (!date) continue;

      if (params.fromDate && date < params.fromDate) continue;
      if (params.toDate && date > params.toDate) continue;

      totalUses += 1;

      if (!lastUsedAt || date > lastUsedAt) {
        lastUsedAt = date;
      }
    }
  }

  return {
    dishId,
    totalUses,
    lastUsedAt,
  };
}

/**
 * Devuelve los platos usados recientemente en la oferta,
 * ordenados por fecha descendente.
 *
 * TODO: si el volumen de week_day_options crece, migrar a
 * vista o RPC con agregación en PostgreSQL.
 */
export async function getRecentDishUsage(
  params: RecentDishUsageParams = {},
): Promise<RecentDishUsageItem[]> {
  const limit = normalizeLimit(params.limit);

  const result = await runSupabase<WeekDayOptionWithRefs[]>(() =>
    supabase
      .from("week_day_options")
      .select(
        `
          id,
          week_days ( date ),
          dish_versions ( dish_id )
        `,
      )
      .eq("option_type", "dish"),
  );

  const byDish = new Map<string, RecentDishUsageItem>();

  for (const row of result ?? []) {
    const dishId = row.dish_versions?.dish_id;
    const date = row.week_days?.date;

    if (!dishId || !date) continue;
    if (params.sinceDate && date < params.sinceDate) continue;

    const current = byDish.get(dishId);

    if (current) {
      current.uses += 1;
      if (date > current.lastUsedAt) {
        current.lastUsedAt = date;
      }
    } else {
      byDish.set(dishId, {
        dishId,
        uses: 1,
        lastUsedAt: date,
      });
    }
  }

  return [...byDish.values()]
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, limit);
}

/**
 * Devuelve platos candidatos para sugerir como oferta.
 *
 * Reglas actuales:
 *  - solo platos activos;
 *  - si se pasa climate, filtra por ese clima;
 *  - si excludeRecentlyUsed=true, excluye los platos usados
 *    en el histórico reciente (ventana actual: 1000 registros).
 *
 * NO implementa un algoritmo de scoring. La sugerencia es un
 * filtro + orden por fecha de último uso descendente.
 *
 * Si en el futuro se necesita scoring por clima + uso reciente,
 * definir la regla primero y migrar a una vista o RPC.
 */
export async function getDishSuggestions(
  params: DishSuggestionParams = {},
): Promise<DishSuggestionItem[]> {
  const limit = normalizeLimit(params.limit);

  let dishesQuery = supabase
    .from("dishes")
    .select("id, climate")
    .eq("active", true);

  if (params.climate) {
    dishesQuery = dishesQuery.eq("climate", params.climate);
  }

  const [dishesResult, usageResult] = await Promise.all([
    runSupabase<{ id: string; climate: string | null }[]>(() => dishesQuery),
    getRecentDishUsage({ limit: 1000 }),
  ]);

  const dishes = dishesResult ?? [];

  if (dishes.length === 0) {
    return [];
  }

  const usageByDish = new Map(usageResult.map((u) => [u.dishId, u]));

  const candidates = params.excludeRecentlyUsed
    ? dishes.filter((d) => !usageByDish.has(d.id))
    : dishes;

  if (candidates.length === 0) {
    return [];
  }

  const candidateIds = candidates.map((d) => d.id);

  const versions = await runSupabase<
    { dish_id: string; name: string; version_number: number }[]
  >(() =>
    supabase
      .from("dish_versions")
      .select("dish_id,name,version_number")
      .in("dish_id", candidateIds),
  );

  const latestNameByDish = new Map<string, string>();
  const latestVersionByDish = new Map<string, number>();

  for (const v of versions ?? []) {
    const currentVersion = latestVersionByDish.get(v.dish_id);

    if (currentVersion === undefined || v.version_number > currentVersion) {
      latestVersionByDish.set(v.dish_id, v.version_number);
      latestNameByDish.set(v.dish_id, v.name);
    }
  }

  return candidates.slice(0, limit).map((dish) => {
    const usage = usageByDish.get(dish.id);

    return {
      dishId: dish.id,
      name: latestNameByDish.get(dish.id) ?? "",
      climate: mapClimate(dish.climate),
      uses: usage?.uses ?? 0,
      lastUsedAt: usage?.lastUsedAt ?? null,
    };
  });
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined) {
    return 20;
  }

  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new AppError(
      "VALIDATION_ERROR",
      "limit debe ser un entero entre 1 y 100.",
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

function mapClimate(value: string | null): Climate | null {
  if (value === "frio" || value === "templado" || value === "calor") {
    return value;
  }

  return null;
}
