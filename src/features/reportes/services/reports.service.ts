import { supabase } from "../../../lib/supabase";
import { runSupabaseOrThrow } from "../../../lib/error-handler";
import { AppError } from "../../../lib/errors";
import type { Modality, OptionType, WeekStatus } from "../../../types/domain";
import type {
  ReportProductSource,
  WeekReport,
  WeekReportClientRow,
  WeekReportDay,
  WeekReportModalityRow,
  WeekReportProductRow,
  WeekReportTotals,
  WeekReportUnansweredClient,
} from "../types/week-report";

/**
 * Reporte de montos consolidados de una semana.
 *
 * Todo el agregado lo hace PostgreSQL (RPC `get_week_report`), que además es
 * la frontera de seguridad: la función exige `private.is_admin()`. El servicio
 * solo valida el input y normaliza snake_case (DB) → camelCase (app).
 *
 * `applied_price` es el precio congelado del pedido: acá nunca se recalcula.
 */
export async function getWeekReport(weekId: string): Promise<WeekReport> {
  validateUuid(weekId, "weekId");

  const raw = await runSupabaseOrThrow<unknown>(() =>
    supabase.rpc("get_week_report", { p_week_id: weekId }),
  );

  return mapWeekReport(raw);
}

function mapWeekReport(value: unknown): WeekReport {
  const root = asRecord(value, "reporte");

  return {
    weekId: asString(root.week_id),
    startDate: asString(root.start_date),
    endDate: asString(root.end_date),
    status: mapWeekStatus(root.status),
    totals: mapTotals(root.totals),
    byDay: asArray(root.by_day).map(mapDay),
    byModality: asArray(root.by_modality).map(mapModalityRow),
    byProduct: asArray(root.by_product).map(mapProductRow),
    byClient: asArray(root.by_client).map(mapClientRow),
    unanswered: asArray(root.unanswered).map(mapUnansweredClient),
  };
}

function mapTotals(value: unknown): WeekReportTotals {
  const row = asRecord(value, "totales");

  return {
    orderCount: asNumber(row.order_count),
    totalQuantity: asNumber(row.total_quantity),
    totalAmount: asNumber(row.total_amount),
    cancellationCount: asNumber(row.cancellation_count),
    expectedClientCount: asNumber(row.expected_client_count),
    respondingClientCount: asNumber(row.responding_client_count),
    unansweredClientCount: asNumber(row.unanswered_client_count),
  };
}

function mapDay(value: unknown): WeekReportDay {
  const row = asRecord(value, "día");

  return {
    weekDayId: asString(row.week_day_id),
    date: asString(row.date),
    dayOfWeek: asNumber(row.day_of_week),
    orderCount: asNumber(row.order_count),
    quantity: asNumber(row.quantity),
    amount: asNumber(row.amount),
    cancellationCount: asNumber(row.cancellation_count),
    unansweredCount: asNumber(row.unanswered_count),
  };
}

function mapModalityRow(value: unknown): WeekReportModalityRow {
  const row = asRecord(value, "modalidad");

  return {
    modality: mapModality(row.modality),
    orderCount: asNumber(row.order_count),
    quantity: asNumber(row.quantity),
    amount: asNumber(row.amount),
  };
}

function mapProductRow(value: unknown): WeekReportProductRow {
  const row = asRecord(value, "producto");

  return {
    source: mapProductSource(row.source),
    optionType: mapOptionType(row.option_type),
    name: asString(row.name),
    modality: mapModality(row.modality),
    orderCount: asNumber(row.order_count),
    quantity: asNumber(row.quantity),
    amount: asNumber(row.amount),
  };
}

function mapClientRow(value: unknown): WeekReportClientRow {
  const row = asRecord(value, "cliente");

  return {
    clientId: asString(row.client_id),
    name: asString(row.name),
    orderCount: asNumber(row.order_count),
    quantity: asNumber(row.quantity),
    amount: asNumber(row.amount),
  };
}

function mapUnansweredClient(value: unknown): WeekReportUnansweredClient {
  const row = asRecord(value, "cliente sin responder");

  return {
    clientId: asString(row.client_id),
    name: asString(row.name),
  };
}

// ------------------------------------------------------------------
// Normalización defensiva: el payload viene de `jsonb`, así que se
// valida la forma antes de exponerlo como tipo de dominio.
// ------------------------------------------------------------------

function asRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError(
      "DATABASE_ERROR",
      `El reporte devolvió un ${fieldName} con un formato inesperado.`,
    );
  }

  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function mapWeekStatus(value: unknown): WeekStatus {
  if (value === "draft" || value === "active" || value === "closed") {
    return value;
  }

  throw new AppError(
    "DATABASE_ERROR",
    `El reporte devolvió un estado de semana inválido: ${String(value)}.`,
  );
}

function mapModality(value: unknown): Modality {
  if (value === "general" || value === "opcional" || value === "media_vianda") {
    return value;
  }

  throw new AppError(
    "DATABASE_ERROR",
    `El reporte devolvió una modalidad inválida: ${String(value)}.`,
  );
}

function mapProductSource(value: unknown): ReportProductSource {
  if (value === "option" || value === "dish" || value === "menu") {
    return value;
  }

  throw new AppError(
    "DATABASE_ERROR",
    `El reporte devolvió un origen de producto inválido: ${String(value)}.`,
  );
}

function mapOptionType(value: unknown): OptionType | null {
  if (value === "dish" || value === "menu") {
    return value;
  }

  return null;
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
