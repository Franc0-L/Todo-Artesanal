/**
 * Cliente esperado de una semana. Representa la población
 * congelada al activar la semana.
 *
 * El "estado actual" del cliente puede diferir del que tenía al
 * congelarse la semana — pero la población congelada en sí es el
 * registro de quién debía responder, no hace falta un snapshot
 * adicional del flag `active`.
 */
export interface WeekExpectedClient {
  weekId: string;
  clientId: string;
  createdAt: string;
  client: {
    name: string;
    phone: string | null;
  } | null;
}

export interface WeekExpectedClientsResult {
  items: WeekExpectedClient[];
  total: number;
}
