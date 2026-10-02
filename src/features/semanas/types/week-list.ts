import type { WeekStatus } from "../../../types/domain";

export interface WeekListItem {
  id: string;
  startDate: string;
  endDate: string;
  status: WeekStatus;
  createdAt: string;
}

export interface WeekListParams {
  status?: WeekStatus;
  page?: number;
  pageSize?: number;
}

export interface WeekListResult {
  items: WeekListItem[];
  total: number;
  page: number;
  pageSize: number;
}
