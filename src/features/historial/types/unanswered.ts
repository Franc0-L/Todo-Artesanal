/**
 * Cliente esperado de una semana que no tiene ni pedido ni
 * cancelación registrada.
 *
 * La condición de "esperado" proviene de week_expected_clients
 * (población congelada al activar la semana), no de
 * clients.active actual.
 */
export interface UnansweredClient {
  clientId: string;
  client: {
    name: string;
    phone: string | null;
  } | null;
}

export interface UnansweredClientsParams {
  page?: number;
  pageSize?: number;
}

export interface UnansweredClientsResult {
  items: UnansweredClient[];
  total: number;
  page: number;
  pageSize: number;
}
