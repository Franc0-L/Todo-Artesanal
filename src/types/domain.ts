/**
 * Tipos de dominio.
 *
 * Estos tipos no vienen del schema de Supabase (los de
 * database.ts sí), sino que expresan conceptos del dominio
 * que se usan repetidamente en el código.
 */

// Modalidades de pedido.
export type Modality = "general" | "opcional" | "media_vianda";

// Modalidades del precio del cliente
export type ClientPriceModality = "general" | "opcional";

// Estados del ciclo de vida de una semana.
export type WeekStatus = "draft" | "active" | "closed";

// Rol de un item dentro de la composición de un menú.
export type MenuItemRole = "main" | "side";

// Tipo de opción de oferta disponible en un día.
export type OptionType = "dish" | "menu";

// Clima de un plato (NULL = sin preferencia climática).
export type Climate = "frio" | "templado" | "calor";

// Día de la semana: 1 = lunes, 5 = viernes.
export type DayOfWeek = 1 | 2 | 3 | 4 | 5;
