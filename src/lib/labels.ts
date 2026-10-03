import type { Modality } from "../types/domain";

/**
 * Etiquetas legibles de las modalidades de pedido, compartidas por todas las
 * features (cliente, pedidos, reportes, historial). Fuente única: evita que
 * cada pantalla redefina su propio `Record<Modality, string>`.
 */
export const MODALITY_LABELS: Record<Modality, string> = {
  general: "General",
  opcional: "Opcional",
  media_vianda: "Media vianda",
};

/**
 * Etiquetas de las modalidades que puede tener una opción de oferta semanal
 * (sin `media_vianda`, que es una modalidad de pedido, no de oferta).
 */
export const OFFER_MODALITY_LABELS: Record<"general" | "opcional", string> = {
  general: "General",
  opcional: "Opcional",
};
