import type { AnchorHTMLAttributes, ReactNode } from "react";
import { navigate } from "./routes";

interface RouteLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Ruta interna a la que navega (ej: `/admin/clientes`). */
  to: string;
  children: ReactNode;
}

/**
 * Enlace interno del router propio.
 *
 * Renderiza un `<a href>` real —así funcionan Ctrl/Cmd-click, clic del medio,
 * "abrir en pestaña" y el menú contextual del navegador— e intercepta el clic
 * normal (izquierdo, sin modificadores) para navegar con `navigate()` sin
 * recargar la página.
 */
export function RouteLink({
  to,
  children,
  onClick,
  ...rest
}: RouteLinkProps) {
  return (
    <a
      href={to}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
