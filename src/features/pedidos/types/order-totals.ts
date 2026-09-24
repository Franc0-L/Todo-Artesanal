import type { Modality } from "../../../types/domain";

export interface OrderTotalsParams {
  clientId?: string;
  weekId?: string;
  weekDayId?: string;
  modality?: Modality;
}

/**
 * Totales agregados de un conjunto de pedidos.
 *
 * totalAmount = SUM(quantity × applied_price). Se calcula en
 * cliente sobre el conjunto filtrado; no se recalcula precio.
 */
export interface OrderTotals {
  orderCount: number;
  totalQuantity: number;
  totalAmount: number;
}
