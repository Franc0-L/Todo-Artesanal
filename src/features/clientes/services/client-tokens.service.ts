import type { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";
import { runSupabase, toAppError } from "../../../lib/error-handler";
import { AppError } from "../../../lib/errors";
import type {
  AuthenticatedClientToken,
  ClientTokenStatus,
  RotatedClientToken,
} from "../types/client-token";

interface RotateTokenResponse {
  token: string;
  clientId: string;
}

interface AuthenticateTokenResponse {
  token: string;
  clientId: string;
  expiresAt: string;
}

/**
 * Obtiene el estado del token activo de un cliente.
 */
export async function getActiveTokenStatus(
  clientId: string,
): Promise<ClientTokenStatus> {
  validateClientId(clientId);

  const token = await runSupabase<{ id: string }>(() =>
    supabase
      .from("client_tokens")
      .select("id")
      .eq("client_id", clientId)
      .is("invalidated_at", null)
      .maybeSingle(),
  );

  return {
    clientId,
    hasActiveToken: token !== null,
  };
}

/**
 * Rota el token personal del cliente.
 *
 * La generación del token la hace la Edge Function
 * `rotate-client-token`, que:
 *  - valida que el caller sea admin;
 *  - invalida el token vigente anterior;
 *  - genera un token random (32 bytes, base64url);
 *  - persiste únicamente el hash (SHA-256);
 *  - devuelve el token en texto plano UNA SOLA VEZ.
 *
 * El token en texto plano se devuelve únicamente en esta
 * respuesta y no debe persistirse en el frontend.
 */
export async function rotateClientToken(
  clientId: string,
): Promise<RotatedClientToken> {
  validateClientId(clientId);

  try {
    const { data, error } =
      await supabase.functions.invoke<RotateTokenResponse>(
        "rotate-client-token",
        {
          body: {
            clientId,
          },
        },
      );

    if (error) {
      throw mapFunctionsError(error);
    }

    if (!data?.token || !data?.clientId) {
      throw new AppError(
        "DATABASE_ERROR",
        "La Edge Function no devolvió un token válido.",
      );
    }

    return {
      clientId: data.clientId,
      token: data.token,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw toAppError(error);
  }
}

/**
 * Intercambia un token personal (que viaja en /menu/:token) por
 * un JWT firmado con claim client_id.
 *
 * Es una llamada PÚBLICA: no requiere JWT de admin. El cliente
 * la invoca al entrar a su link personal.
 *
 * La Edge Function:
 *  - computa SHA-256 del token recibido;
 *  - busca una fila vigente en client_tokens;
 *  - si no existe, devuelve 401 (token inválido o expirado);
 *  - si existe, firma un JWT con claim client_id y lo devuelve.
 *
 * El JWT devuelto debe guardarse en el frontend (cookie
 * httpOnly o storage según la estrategia) y usarse para
 * autenticar las llamadas a Supabase como cliente.
 */
export async function authenticateClientToken(
  plaintextToken: string,
): Promise<AuthenticatedClientToken> {
  validatePlaintextToken(plaintextToken);

  try {
    const { data, error } =
      await supabase.functions.invoke<AuthenticateTokenResponse>(
        "authenticate-client-token",
        {
          body: {
            token: plaintextToken,
          },
        },
      );

    if (error) {
      throw mapFunctionsError(error);
    }

    if (!data?.token || !data?.clientId || !data?.expiresAt) {
      throw new AppError(
        "DATABASE_ERROR",
        "La Edge Function no devolvió una autenticación válida.",
      );
    }

    return {
      token: data.token,
      clientId: data.clientId,
      expiresAt: data.expiresAt,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw toAppError(error);
  }
}

function mapFunctionsError(error: FunctionsHttpError): AppError {
  const status = error.context?.status;

  if (status === 400) {
    return new AppError("VALIDATION_ERROR", error.message, {
      cause: error,
    });
  }

  if (status === 401) {
    return new AppError("UNAUTHORIZED", error.message, {
      cause: error,
    });
  }

  if (status === 403) {
    return new AppError("FORBIDDEN", error.message, {
      cause: error,
    });
  }

  if (status === 404) {
    return new AppError("NOT_FOUND", error.message, {
      cause: error,
    });
  }

  return new AppError("DATABASE_ERROR", error.message, {
    cause: error,
  });
}

function validateClientId(clientId: string): void {
  if (
    typeof clientId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clientId,
    )
  ) {
    throw new AppError("VALIDATION_ERROR", "clientId debe ser un UUID válido.");
  }
}

function validatePlaintextToken(token: string): void {
  if (typeof token !== "string" || token.length < 16) {
    throw new AppError(
      "VALIDATION_ERROR",
      "El token debe ser un texto no vacío.",
    );
  }
}
