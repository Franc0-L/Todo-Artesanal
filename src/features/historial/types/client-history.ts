import type { WeekStatus } from "../../../types/domain";
import type { OrderDetail } from "../../pedidos/types/order-detail";
import type { Cancellation } from "../../cancelaciones/types/cancellation";

/**
 * Entrada del historial de un cliente: una semana con sus
 * pedidos y cancelaciones.
 */
export interface ClientHistoryEntry {
  week: {
    id: string;
    startDate: string;
    endDate: string;
    status: WeekStatus;
  };
  orders: OrderDetail[];
  cancellations: Cancellation[];
  /**
   * SUM(quantity × applied_price) de los pedidos de esa semana.
   * Calculado en cliente.
   */
  totalAmount: number;
}

export interface ClientHistoryParams {
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface ClientHistoryResult {
  clientId: string;
  entries: ClientHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
}
