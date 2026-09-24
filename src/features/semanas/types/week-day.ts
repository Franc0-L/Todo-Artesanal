import type { DayOfWeek } from "../../../types/domain";

export interface WeekDay {
  id: string;
  weekId: string;
  dayOfWeek: DayOfWeek;
  date: string;
  createdAt: string;
}
