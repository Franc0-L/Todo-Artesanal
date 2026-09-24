import type { OptionType } from "../../../types/domain";
import type { DishVersion } from "../../platos/types/dish-version";
import type { MenuVersionSummary } from "../../menus/types/menu-version";
import type { WeekDay } from "./week-day";

/**
 * Opción de oferta de un día concreto.
 *
 * Por la XOR del schema, exactamente uno de dishVersion o
 * menuVersion es no-null. La UI decide qué mostrar según
 * optionType.
 *
 * dishVersion viene completo (es flat, sin composición interna).
 * menuVersion viene como MenuVersionSummary (sin items): en un
 * listado no hace falta la composición del menú; si la UI la
 * necesita, consulta getMenuVersion(menuVersion.id).
 */
export interface WeekDayOption {
  id: string;
  weekDayId: string;
  optionType: OptionType;
  dishVersion: DishVersion | null;
  menuVersion: MenuVersionSummary | null;
  createdAt: string;
}

/**
 * Input para agregar una opción a un día.
 *
 * Discriminated union: se pasa exactamente uno de dishVersionId
 * o menuVersionId, consistente con optionType.
 */
export type AddDayOptionInput =
  | {
      weekDayId: string;
      optionType: "dish";
      dishVersionId: string;
    }
  | {
      weekDayId: string;
      optionType: "menu";
      menuVersionId: string;
    };

/**
 * Input para actualizar la versión referenciada por una opción.
 *
 * No permite cambiar de dish a menu ni viceversa. Para eso,
 * eliminar la opción y crear una nueva.
 */
export type UpdateDayOptionInput =
  | {
      optionType: "dish";
      dishVersionId: string;
    }
  | {
      optionType: "menu";
      menuVersionId: string;
    };

/**
 * Día de la semana con sus opciones de oferta.
 */
export interface WeekOfferDay {
  weekDay: WeekDay;
  options: WeekDayOption[];
}

/**
 * Oferta completa de una semana: cada día con sus opciones.
 */
export interface WeekOffer {
  weekId: string;
  days: WeekOfferDay[];
}
