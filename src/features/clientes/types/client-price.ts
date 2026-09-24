import type { ClientPriceModality } from "../../../types/domain";

export interface ClientPrice {
  id: string;
  clientId: string;
  modality: ClientPriceModality;
  price: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientProductPrice {
  id: string;
  clientId: string;
  dishId: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPrices {
  general: ClientPrice | null;
  opcional: ClientPrice | null;
  products: ClientProductPrice[];
}

export interface SetClientPriceInput {
  clientId: string;
  modality: ClientPriceModality;
  price: number;
}

export interface SetClientProductPriceInput {
  clientId: string;
  dishId: string;
  price: number;
}
