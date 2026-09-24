/**
 * Cancelación de un cliente para un día concreto.
 *
 * Representa un hecho histórico inmutable: se crea o se elimina.
 * No hay updateCancellation. Si el admin se equivocó al cargarla,
 * borra y crea otra.
 *
 * Enriquecida con los datos de contexto que la UI necesita para
 * mostrarla sin consultas adicionales.
 */
export interface Cancellation {
  id: string;
  clientId: string;
  weekDayId: string;
  createdAt: string;
  updatedAt: string;
  client: {
    name: string;
    phone: string | null;
  } | null;
  weekDay: {
    id: string;
    date: string;
    dayOfWeek: 1 | 2 | 3 | 4 | 5;
  } | null;
  week: {
    id: string;
    startDate: string;
    endDate: string;
  } | null;
}

/**
 * Input para registrar una cancelación.
 *
 * El trigger prevent_cancellation_with_order valida que el
 * cliente no tenga ya un pedido para ese mismo día.
 * El UNIQUE (client_id, week_day_id) impide duplicados.
 */
export interface CreateCancellationInput {
  clientId: string;
  weekDayId: string;
}
