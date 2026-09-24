import type { Modality } from "../../../types/domain";

/**
 * Pedido (entidad base, sin enriquecimiento).
 *
 * appliedPrice queda congelado al crear el pedido (lo calcula el
 * trigger validate_order en la DB). Nunca se recalcula.
 */
export interface Order {
  id: string;
  clientId: string;
  weekDayOptionId: string;
  modality: Modality;
  quantity: number;
  appliedPrice: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para crear un pedido.
 *
 * NO incluye appliedPrice: lo calcula el trigger
 * validate_order (BEFORE INSERT) usando calculate_order_price.
 * El cliente jamás manda el precio.
 *
 * El trigger también valida:
 *  - semana activa;
 *  - cliente en week_expected_clients;
 *  - allows_half_portion si modality = media_vianda.
 */
export interface CreateOrderInput {
  clientId: string;
  weekDayOptionId: string;
  modality: Modality;
  quantity: number;
  notes?: string | null;
}

/**
 * Input para actualizar un pedido.
 *
 * Solo quantity y notes son editables. clientId,
 * weekDayOptionId, modality y appliedPrice son inmutables
 * (el trigger validate_order rechaza sus cambios).
 */
export interface UpdateOrderInput {
  quantity?: number;
  notes?: string | null;
}
