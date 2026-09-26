import { listCancellations } from "../../cancelaciones/services/cancellations.service";
import type { Cancellation } from "../../cancelaciones/types/cancellation";
import { listOrders } from "../../pedidos/services/orders.service";
import type { OrderDetail } from "../../pedidos/types/order-detail";
import { AppError } from "../../../lib/errors";

export interface HistoricalWeekDetail {
  orders: OrderDetail[];
  cancellations: Cancellation[];
}

/**
 * Obtiene los hechos registrados de una semana cerrada.
 *
 * La consulta se compone a partir de los servicios de pedidos y
 * cancelaciones existentes para mantener una única capa de acceso a
 * Supabase y reutilizar sus mapeos/validaciones.
 */
export async function getHistoricalWeekDetail(
  weekId: string,
): Promise<HistoricalWeekDetail> {
  validateUuid(weekId, "weekId");

  const [ordersResult, cancellationsResult] = await Promise.all([
    listOrders({ weekId, page: 1, pageSize: 100 }),
    listCancellations({ weekId, page: 1, pageSize: 100 }),
  ]);

  if (ordersResult.total > ordersResult.items.length) {
    throw new AppError(
      "BUSINESS_RULE",
      "La semana contiene más pedidos de los que puede mostrar el detalle histórico.",
    );
  }

  if (cancellationsResult.total > cancellationsResult.items.length) {
    throw new AppError(
      "BUSINESS_RULE",
      "La semana contiene más cancelaciones de las que puede mostrar el detalle histórico.",
    );
  }

  return {
    orders: ordersResult.items,
    cancellations: cancellationsResult.items,
  };
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
