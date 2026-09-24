import type { PostgrestError } from "@supabase/supabase-js";
import { AppError, isAppError } from "./errors";

interface SupabaseResult<T> {
  data: T | null;
  error: PostgrestError | null;
}

interface SupabaseFullResult<T> extends SupabaseResult<T> {
  count?: number | null;
  status?: number;
}

export async function runSupabase<T>(
  operation: () => PromiseLike<SupabaseResult<T>>,
): Promise<T | null> {
  try {
    const { data, error } = await operation();

    if (error) {
      throw toAppError(error);
    }

    return data;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    throw toAppError(error);
  }
}

export async function runSupabaseFull<T>(
  operation: () => PromiseLike<SupabaseFullResult<T>>,
): Promise<{
  data: T | null;
  count: number | null;
  status: number;
}> {
  try {
    const response = await operation();

    if (response.error) {
      throw toAppError(response.error);
    }

    return {
      data: response.data,
      count: response.count ?? null,
      status: response.status ?? 200,
    };
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    throw toAppError(error);
  }
}

export async function runSupabaseOrThrow<T>(
  operation: () => PromiseLike<SupabaseResult<T>>,
): Promise<T> {
  const data = await runSupabase(operation);

  if (data === null) {
    throw new AppError("NOT_FOUND", "No se encontró el registro solicitado.");
  }

  return data;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (isPostgrestError(error)) {
    return mapPostgrestError(error);
  }

  if (error instanceof Error) {
    return new AppError("UNKNOWN_ERROR", error.message, {
      cause: error,
    });
  }

  return new AppError("UNKNOWN_ERROR", "Ocurrió un error inesperado.", {
    cause: error,
  });
}

function isPostgrestError(error: unknown): error is PostgrestError {
  if (!error || typeof error !== "object") {
    return false;
  }

  const value = error as Partial<PostgrestError>;

  return typeof value.message === "string" && typeof value.code === "string";
}

function mapPostgrestError(error: PostgrestError): AppError {
  switch (error.code) {
    case "P0001":
      return new AppError("BUSINESS_RULE", error.message, {
        cause: error,
        details: error.details,
      });

    case "PGRST301":
      return new AppError("FORBIDDEN", error.message, {
        cause: error,
        details: error.details,
      });

    case "23502":
      return new AppError("VALIDATION_ERROR", error.message, {
        cause: error,
        details: error.details,
      });

    case "23505":
      return new AppError("CONFLICT", "El registro ya existe.", {
        cause: error,
        details: error.details,
      });

    case "23503":
      return new AppError(
        "CONFLICT",
        "La operación no puede realizarse porque el registro está relacionado con otros datos.",
        {
          cause: error,
          details: error.details,
        },
      );

    case "23514":
      return new AppError(
        "VALIDATION_ERROR",
        "Los datos no cumplen una regla válida del sistema.",
        {
          cause: error,
          details: error.details,
        },
      );

    case "23P01":
      return new AppError(
        "CONFLICT",
        "El rango de fechas se superpone con otra semana existente.",
        {
          cause: error,
          details: error.details,
        },
      );

    case "42501":
      return new AppError(
        "FORBIDDEN",
        "No tenés permisos para realizar esta operación.",
        {
          cause: error,
          details: error.details,
        },
      );

    case "PGRST116":
      return new AppError(
        "NOT_FOUND",
        "No se encontró el registro solicitado.",
        {
          cause: error,
          details: error.details,
        },
      );

    default:
      return new AppError(
        "DATABASE_ERROR",
        error.message || "Ocurrió un error en la base de datos.",
        {
          cause: error,
          details: error.details,
        },
      );
  }
}
