import type { Climate } from "../../../types/domain";

export interface DishUsage {
  dishId: string;
  totalUses: number;
  lastUsedAt: string | null;
}

export interface DishUsageParams {
  fromDate?: string;
  toDate?: string;
}

export interface RecentDishUsageItem {
  dishId: string;
  uses: number;
  lastUsedAt: string;
}

export interface RecentDishUsageParams {
  sinceDate?: string;
  limit?: number;
}

export interface DishSuggestionParams {
  climate?: Climate;
  limit?: number;
  excludeRecentlyUsed?: boolean;
}

export interface DishSuggestionItem {
  dishId: string;
  name: string;
  climate: Climate | null;
  uses: number;
  lastUsedAt: string | null;
}
