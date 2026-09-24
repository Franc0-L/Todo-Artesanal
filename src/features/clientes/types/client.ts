export interface Client {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  specialCare: string | null;
  allowsHalfPortion: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  specialCare?: string | null;
  allowsHalfPortion?: boolean;
  active?: boolean;
}

export interface UpdateClientInput {
  name?: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  specialCare?: string | null;
  allowsHalfPortion?: boolean;
}
