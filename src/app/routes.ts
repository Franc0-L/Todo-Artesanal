export type AppRoute =
  | { kind: "admin"; path: "/admin" }
  | { kind: "client-menu"; path: "/menu/:token"; token: string }
  | { kind: "home"; path: "/" }
  | { kind: "not-found"; path: string };

export function resolveRoute(pathname: string): AppRoute {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  if (normalizedPath === "/") return { kind: "home", path: "/" };
  if (normalizedPath === "/admin") return { kind: "admin", path: "/admin" };

  const menuMatch = normalizedPath.match(/^\/menu\/([^/]+)$/);
  if (menuMatch) {
    return {
      kind: "client-menu",
      path: "/menu/:token",
      token: menuMatch[1],
    };
  }

  return { kind: "not-found", path: normalizedPath };
}
