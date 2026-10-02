import type { Modality } from "../../../types/domain";
import type { OrderDetail } from "./order-detail";

export interface OrderListParams {
  clientId?: string;
  weekId?: string;
  weekDayId?: string;
  modality?: Modality;
  page?: number;
  pageSize?: number;
}

export interface OrderListResult {
  items: OrderDetail[];
  total: number;
  page: number;
  pageSize: number;
}
