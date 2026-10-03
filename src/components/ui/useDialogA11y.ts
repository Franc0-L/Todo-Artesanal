import { useEffect, useRef, type RefObject } from "react";

/**
 * Elementos que pueden recibir foco para el ciclo de `Tab` dentro del diálogo.
 * Quedan fuera los deshabilitados y los ocultos por `type="hidden"`.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface UseDialogA11yOptions {
  /** true cuando el diálogo está montado y visible. */
  active: boolean;
  /**
   * Elemento que recibe el foco al abrir (p. ej. el botón de cierre o el de
   * confirmación). Si no se pasa, se enfoca el primer elemento enfocable.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Accesibilidad de diálogos modales (drawers y `ConfirmDialog`).
 *
 * Responsabilidades:
 *  - llevar el foco al primer elemento útil al abrir;
 *  - atrapar `Tab`/`Shift+Tab` dentro del contenedor;
 *  - marcar como `inert` el resto de la página (hermanos de los ancestros
 *    hasta `<body>`), para que ni el foco ni el lector de pantalla escapen;
 *  - restaurar el foco al elemento que abrió el diálogo al cerrarse.
 *
 * No maneja `Escape`: cada consumidor lo resuelve con su propio flujo de
 * cierre (que puede pedir confirmación si hay cambios sin guardar), evitando
 * que un mismo `Escape` dispare el cierre dos veces.
 */
export function useDialogA11y<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  { active, initialFocusRef }: UseDialogA11yOptions,
): void {
  // Callbacks y refs leídos "frescos" sin volver a ejecutar el efecto (que
  // reenfocaría el diálogo en cada render).
  const initialFocusRefRef = useRef(initialFocusRef);
  useEffect(() => {
    initialFocusRefRef.current = initialFocusRef;
  });

  useEffect(() => {
    if (!active) return;
    const container: HTMLElement | null = containerRef.current;
    if (!container) return;
    // Alias no-nulo: el estrechamiento de tipos no se conserva dentro de los
    // handlers anidados, así que ahí se usa `root`.
    const root: HTMLElement = container;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute("aria-hidden"));

    const initial = initialFocusRefRef.current?.current ?? focusables()[0];
    initial?.focus();

    // Marca como inertes los hermanos de cada ancestro hasta <body>. Se anota
    // si ya tenían `inert` para no quitarlo a quien no lo puso este hook.
    const inertTargets: { element: HTMLElement; hadInert: boolean }[] = [];
    let node: HTMLElement | null = root;
    while (node && node !== document.body && node.parentElement) {
      const parent: HTMLElement = node.parentElement;
      for (const child of Array.from(parent.children)) {
        if (child !== node && child instanceof HTMLElement) {
          inertTargets.push({
            element: child,
            hadInert: child.hasAttribute("inert"),
          });
          child.setAttribute("inert", "");
        }
      }
      node = parent;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const inside = current instanceof HTMLElement && root.contains(current);

      if (event.shiftKey) {
        if (!inside || current === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    root.addEventListener("keydown", handleKeyDown);

    return () => {
      root.removeEventListener("keydown", handleKeyDown);
      for (const { element, hadInert } of inertTargets) {
        if (!hadInert) element.removeAttribute("inert");
      }
      previouslyFocused?.focus();
    };
  }, [active, containerRef]);
}
