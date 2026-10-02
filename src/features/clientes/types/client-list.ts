export interface ClientListItem {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  active: boolean;
}

export interface ClientListParams {
  search?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ClientListResult {
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
}
