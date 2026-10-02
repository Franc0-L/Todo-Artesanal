import { supabase } from "../../../lib/supabase";
import { runSupabase, runSupabaseOrThrow } from "../../../lib/error-handler";
import { AppError } from "../../../lib/errors";
import type { Tables } from "../../../types/database";
import type { ClientPriceModality } from "../../../types/domain";
import type {
  ClientPrice,
  ClientPrices,
  ClientProductPrice,
  SetClientPriceInput,
  SetClientProductPriceInput,
} from "../types/client-price";

type ClientPriceRow = Tables<"client_prices">;
type ClientProductPriceRow = Tables<"client_product_prices">;

const CLIENT_PRICE_COLUMNS =
  "id,client_id,modality,price,created_at,updated_at";

const CLIENT_PRODUCT_PRICE_COLUMNS =
  "id,client_id,dish_id,price,created_at,updated_at";

export async function getClientPrices(clientId: string): Promise<ClientPrices> {
  validateUuid(clientId, "clientId");

  const [clientPrices, productPrices] = await Promise.all([
    runSupabase<ClientPriceRow[]>(() =>
      supabase
        .from("client_prices")
        .select(CLIENT_PRICE_COLUMNS)
        .eq("client_id", clientId)
        .order("modality", { ascending: true }),
    ),
    runSupabase<ClientProductPriceRow[]>(() =>
      supabase
        .from("client_product_prices")
        .select(CLIENT_PRODUCT_PRICE_COLUMNS)
        .eq("client_id", clientId)
        .order("dish_id", { ascending: true }),
    ),
  ]);

  const prices = clientPrices ?? [];
  const products = productPrices ?? [];

  const generalRow = prices.find((price) => price.modality === "general");

  const opcionalRow = prices.find((price) => price.modality === "opcional");

  return {
    general: generalRow ? mapClientPrice(generalRow) : null,
    opcional: opcionalRow ? mapClientPrice(opcionalRow) : null,
    products: products.map(mapClientProductPrice),
  };
}

export async function setClientPrice(
  input: SetClientPriceInput,
): Promise<ClientPrice> {
  validateSetClientPriceInput(input);

  const result = await runSupabaseOrThrow<ClientPriceRow>(() =>
    supabase
      .from("client_prices")
      .upsert(
        {
          client_id: input.clientId,
          modality: input.modality,
          price: input.price,
        },
        {
          onConflict: "client_id,modality",
        },
      )
      .select(CLIENT_PRICE_COLUMNS)
      .single(),
  );

  return mapClientPrice(result);
}

export async function removeClientPrice(
  clientId: string,
  modality: ClientPriceModality,
): Promise<void> {
  validateUuid(clientId, "clientId");
  validateModality(modality);

  await runSupabase<unknown>(() =>
    supabase
      .from("client_prices")
      .delete()
      .eq("client_id", clientId)
      .eq("modality", modality),
  );
}

export async function listClientProductPrices(
  clientId: string,
): Promise<ClientProductPrice[]> {
  validateUuid(clientId, "clientId");

  const result = await runSupabase<ClientProductPriceRow[]>(() =>
    supabase
      .from("client_product_prices")
      .select(CLIENT_PRODUCT_PRICE_COLUMNS)
      .eq("client_id", clientId)
      .order("dish_id", { ascending: true }),
  );

  return (result ?? []).map(mapClientProductPrice);
}

export async function setClientProductPrice(
  input: SetClientProductPriceInput,
): Promise<ClientProductPrice> {
  validateSetClientProductPriceInput(input);

  const result = await runSupabaseOrThrow<ClientProductPriceRow>(() =>
    supabase
      .from("client_product_prices")
      .upsert(
        {
          client_id: input.clientId,
          dish_id: input.dishId,
          price: input.price,
        },
        {
          onConflict: "client_id,dish_id",
        },
      )
      .select(CLIENT_PRODUCT_PRICE_COLUMNS)
      .single(),
  );

  return mapClientProductPrice(result);
}

export async function removeClientProductPrice(
  clientId: string,
  dishId: string,
): Promise<void> {
  validateUuid(clientId, "clientId");
  validateUuid(dishId, "dishId");

  await runSupabase<unknown>(() =>
    supabase
      .from("client_product_prices")
      .delete()
      .eq("client_id", clientId)
      .eq("dish_id", dishId),
  );
}

function validateSetClientPriceInput(input: SetClientPriceInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Los datos del precio son obligatorios.",
    );
  }

  validateUuid(input.clientId, "clientId");
  validateModality(input.modality);
  validatePrice(input.price);
}

function validateSetClientProductPriceInput(
  input: SetClientProductPriceInput,
): void {
  if (!input || typeof input !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Los datos del precio del plato son obligatorios.",
    );
  }

  validateUuid(input.clientId, "clientId");
  validateUuid(input.dishId, "dishId");
  validatePrice(input.price);
}

function validateModality(modality: ClientPriceModality): void {
  if (modality !== "general" && modality !== "opcional") {
    throw new AppError(
      "VALIDATION_ERROR",
      "La modalidad del precio debe ser general u opcional.",
    );
  }
}

function validatePrice(value: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "El precio debe ser un número mayor o igual a 0.",
    );
  }
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

function mapClientPrice(row: ClientPriceRow): ClientPrice {
  if (row.modality !== "general" && row.modality !== "opcional") {
    throw new AppError(
      "DATABASE_ERROR",
      `La modalidad almacenada es inválida: ${row.modality}.`,
    );
  }

  return {
    id: row.id,
    clientId: row.client_id,
    modality: row.modality,
    price: row.price,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClientProductPrice(row: ClientProductPriceRow): ClientProductPrice {
  return {
    id: row.id,
    clientId: row.client_id,
    dishId: row.dish_id,
    price: row.price,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
