import type { Modality, OptionType, WeekStatus } from "../../../types/domain";

/**
 * Origen del producto de un pedido dentro de la oferta semanal:
 *  - `option`: opción de oferta del día (general / opcional);
 *  - `dish`: plato suelto del catálogo (solo media vianda);
 *  - `menu`: menú del catálogo (solo media vianda).
 */
export type ReportProductSource = "option" | "dish" | "menu";

/**
 * Totales consolidados de una semana.
 *
 * `totalAmount` es SUM(quantity × applied_price) — el precio congelado en el
 * pedido. El reporte agrega, nunca recalcula precio (ADR-003).
 *
 * `unansweredClientCount` se computa contra `week_expected_clients` (la
 * población congelada al activar la semana), nunca contra `clients.active`
 * (ADR-005).
 */
export interface WeekReportTotals {
  orderCount: number;
  totalQuantity: number;
  totalAmount: number;
  cancellationCount: number;
  expectedClientCount: number;
  respondingClientCount: number;
  unansweredClientCount: number;
}

/** Consolidado de un día de la semana (incluye los días sin pedidos). */
export interface WeekReportDay {
  weekDayId: string;
  date: string;
  dayOfWeek: number;
  orderCount: number;
  quantity: number;
  amount: number;
  cancellationCount: number;
  unansweredCount: number;
}

/** Consolidado por modalidad de pedido. */
export interface WeekReportModalityRow {
  modality: Modality;
  orderCount: number;
  quantity: number;
  amount: number;
}

/** Consolidado por producto (opción de oferta o ítem de catálogo). */
export interface WeekReportProductRow {
  source: ReportProductSource;
  /** Solo tiene valor cuando `source === "option"`. */
  optionType: OptionType | null;
  name: string;
  modality: Modality;
  orderCount: number;
  quantity: number;
  amount: number;
}

/** Consolidado por cliente (solo quienes pidieron algo en la semana). */
export interface WeekReportClientRow {
  clientId: string;
  name: string;
  orderCount: number;
  quantity: number;
  amount: number;
}

/** Cliente esperado que no registró ni pedido ni cancelación. */
export interface WeekReportUnansweredClient {
  clientId: string;
  name: string;
}

/** Reporte de montos consolidados de una semana (RPC `get_week_report`). */
export interface WeekReport {
  weekId: string;
  startDate: string;
  endDate: string;
  status: WeekStatus;
  totals: WeekReportTotals;
  byDay: WeekReportDay[];
  byModality: WeekReportModalityRow[];
  byProduct: WeekReportProductRow[];
  byClient: WeekReportClientRow[];
  unanswered: WeekReportUnansweredClient[];
}
