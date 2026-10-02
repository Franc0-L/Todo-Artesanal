import type { WeekStatus } from "../../../types/domain";

export interface Week {
  id: string;
  startDate: string;
  endDate: string;
  status: WeekStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para crear una semana.
 *
 * El RPC create_week valida que startDate sea lunes y endDate
 * sea viernes, y genera los 5 días correspondientes. Ver
 * 20260924000002_week_rpc.sql.
 */
export interface CreateWeekInput {
  startDate: string;
  endDate: string;
}

/**
 * Input para actualizar las fechas de una semana en draft.
 *
 * ADVERTENCIA: si ya hay opciones de oferta cargadas, se
 * eliminan (cascade). El flujo esperado es configurar fechas
 * antes de cargar opciones.
 */
export interface UpdateWeekInput {
  startDate: string;
  endDate: string;
}
