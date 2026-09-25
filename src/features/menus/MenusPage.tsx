import { useCallback, useEffect, useRef, useState } from "react";
import { MenuDrawer } from "./MenuDrawer";
import { listMenus } from "./services/menus.service";
import type { Menu, MenuWithCurrentVersion } from "./types/menu";
import type { MenuListItem } from "./types/menu-list";
import "./menus.css";

export function MenusPage() {
  const [items, setItems] = useState<MenuListItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("active");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{
    mode: "create" | "edit";
    id: string | null;
  } | null>(null);
  const requestId = useRef(0);
  const pageSize = 20;

  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listMenus({
        page,
        pageSize,
        search: search || undefined,
        active: activeFilter === "all" ? undefined : activeFilter === "active",
      });
      if (request !== requestId.current) return;
      setItems(result.items);
      setTotal(result.total);
    } catch (e: unknown) {
      if (request === requestId.current)
        setError(
          e instanceof Error ? e.message : "No se pudieron cargar los menús.",
        );
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [activeFilter, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateMenu(menu: Menu) {
    setItems((current) =>
      current.map((item) =>
        item.id === menu.id ? { ...item, active: menu.active } : item,
      ),
    );
  }
  function created(menu: MenuWithCurrentVersion) {
    const newItem: MenuListItem = {
      id: menu.id,
      name: menu.currentVersion?.name ?? null,
      itemCount: menu.currentVersion?.items.length ?? 0,
      active: menu.active,
      createdAt: menu.createdAt,
    };
    setItems((current) => [newItem, ...current].slice(0, pageSize));
    setTotal((totalCount) => totalCount + 1);
    setPage(1);
    setDrawer({ mode: "edit", id: menu.id });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="menus-page">
      <header className="menus-page__header">
        <div>
          <p className="menus-page__eyebrow">Catálogo</p>
          <h1>Menús</h1>
          <p>Composiciones versionadas de platos para las ofertas semanales.</p>
        </div>
        <button
          className="menus-page__primary"
          type="button"
          onClick={() => setDrawer({ mode: "create", id: null })}
        >
          Nuevo menú
        </button>
      </header>
      <section className="menus-page__toolbar" aria-label="Filtros de menús">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por nombre…"
          aria-label="Buscar menús"
        />
        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value as typeof activeFilter);
            setPage(1);
          }}
          aria-label="Filtrar por estado"
        >
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </select>
      </section>
      {error && (
        <div className="menus-feedback menus-feedback--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}
      {loading ? (
        <p className="menus-feedback">Cargando menús…</p>
      ) : items.length === 0 ? (
        <section className="menus-empty">
          <h2>{search ? "Sin resultados" : "No hay menús"}</h2>
          <p>
            {search
              ? "Probá con otra búsqueda."
              : "Creá el primer menú para empezar a componer ofertas."}
          </p>
          {!search && (
            <button
              className="menus-page__primary"
              type="button"
              onClick={() => setDrawer({ mode: "create", id: null })}
            >
              Crear menú
            </button>
          )}
        </section>
      ) : (
        <>
          <div className="menus-table-wrap">
            <table className="menus-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Composición</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td colSpan={3}>
                      <button
                        className="menus-row"
                        type="button"
                        onClick={() => setDrawer({ mode: "edit", id: item.id })}
                      >
                        <span className="menus-row__name">
                          {item.name ?? "Sin nombre"}
                        </span>
                        <span>
                          {item.itemCount} ítem{item.itemCount === 1 ? "" : "s"}
                        </span>
                        <span
                          className={`menus-status menus-status--${item.active ? "active" : "inactive"}`}
                        >
                          {item.active ? "Activo" : "Inactivo"}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="menus-pagination" aria-label="Paginación">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
      <MenuDrawer
        mode={drawer?.mode ?? "edit"}
        menuId={drawer?.id ?? null}
        onClose={() => setDrawer(null)}
        onCreated={created}
        onSaved={updateMenu}
      />
    </main>
  );
}
