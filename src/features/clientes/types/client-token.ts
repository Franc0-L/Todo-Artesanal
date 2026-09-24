export interface ClientTokenStatus {
  clientId: string;
  hasActiveToken: boolean;
}

export interface RotatedClientToken {
  clientId: string;
  token: string;
}

/**
 * JWT emitido por la Edge Function authenticate-client-token.
 *
 * Se genera a partir del token personal del cliente (que viaja
 * en la URL /menu/:token). El JWT tiene claim client_id y role
 * authenticated, para que PostgREST aplique las policies de
 * cliente.
 *
 * expiresAt es ISO 8601. El JWT tiene 7 días de vida; al
 * expirar, el cliente vuelve a entrar por su link personal.
 */
export interface AuthenticatedClientToken {
  token: string;
  clientId: string;
  expiresAt: string;
}
