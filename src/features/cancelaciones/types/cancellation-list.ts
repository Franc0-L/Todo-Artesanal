import type { Cancellation } from "./cancellation";

export interface CancellationListParams {
  clientId?: string;
  weekId?: string;
  weekDayId?: string;
  page?: number;
  pageSize?: number;
}

export interface CancellationListResult {
  items: Cancellation[];
  total: number;
  page: number;
  pageSize: number;
}
