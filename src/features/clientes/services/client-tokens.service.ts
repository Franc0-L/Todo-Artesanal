import type { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";
import { runSupabase, toAppError } from "../../../lib/error-handler";
import { AppError } from "../../../lib/errors";
import type {
  ClientTokenStatus,
  RotatedClientToken,
} from "../types/client-token";

interface RotateTokenResponse {
  token: string;
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
 * La generación real del token se realiza mediante una Edge
 * Function. La implementación de dicha Edge Function queda
 * pendiente.
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

    if (!data?.token) {
      throw new AppError(
        "DATABASE_ERROR",
        "La Edge Function no devolvió un token válido.",
      );
    }

    return {
      clientId,
      token: data.token,
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

  if (status === 401 || status === 403) {
    return new AppError("FORBIDDEN", error.message, {
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
