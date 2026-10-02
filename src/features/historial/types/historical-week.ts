/**
 * Semana histórica con agregados.
 *
 * Los agregados se computan en el servicio a partir de las
 * tablas orders, cancellations y week_expected_clients.
 *
 * unansweredClientCount = expectedClientCount menos los
 * clientes que efectivamente respondieron (con pedido o con
 * cancelación). Se computa contra week_expected_clients, nunca
 * contra clients.active (invariante #13).
 */
export interface HistoricalWeek {
  id: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  orderCount: number;
  totalQuantity: number;
  totalAmount: number;
  cancellationCount: number;
  expectedClientCount: number;
  unansweredClientCount: number;
}

export interface HistoricalWeekParams {
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface HistoricalWeekListResult {
  items: HistoricalWeek[];
  total: number;
  page: number;
  pageSize: number;
}
