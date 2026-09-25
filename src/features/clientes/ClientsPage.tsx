import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ClientDrawer } from "./ClientDrawer";
import { listClients } from "./services/clients.service";
import type { Client } from "./types/client";
import type { ClientListItem } from "./types/client-list";
import "./clients.css";
import "./client-details.css";

const PAGE_SIZE = 20;
type StatusFilter = "all" | "active" | "inactive";

export function ClientsPage() {
  const [items, setItems] = useState<ClientListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listClients({
        search: search || undefined,
        active: statusFilter === "all" ? undefined : statusFilter === "active",
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (loadError) {
      setItems([]);
      setTotal(0);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los clientes.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const handleCloseDrawer = useCallback(() => {
    setSelectedClientId(null);
    setCreateDrawerOpen(false);
  }, []);

  const handleClientCreated = useCallback((created: Client) => {
    setCreateDrawerOpen(false);
    setSelectedClientId(created.id);
    setPage(1);
  }, []);

  const handleClientSaved = useCallback((updated: Client) => {
    setItems((current) =>
      current.map((item) =>
        item.id === updated.id
          ? {
              ...item,
              name: updated.name,
              phone: updated.phone,
              address: updated.address,
              active: updated.active,
            }
          : item,
      ),
    );
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleStatusChange(value: StatusFilter) {
    setPage(1);
    setStatusFilter(value);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="clients-page" aria-labelledby="clients-title">
      <header className="clients-page__header">
        <div className="clients-page__heading-row">
          <div>
            <p className="clients-page__eyebrow">Administración</p>
            <h1 id="clients-title">Clientes</h1>
            <p className="clients-page__description">
              Gestioná los clientes y accedé a su ficha cuando sea necesario.
            </p>
          </div>
          <button
            className="clients-primary-action"
            type="button"
            onClick={() => {
              setSelectedClientId(null);
              setCreateDrawerOpen(true);
            }}
          >
            Nuevo cliente
          </button>
        </div>
      </header>

      <div className="clients-toolbar">
        <form className="clients-search" onSubmit={handleSearchSubmit}>
          <label htmlFor="client-search">Buscar</label>
          <div className="clients-search__controls">
            <input
              id="client-search"
              name="search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nombre, teléfono o dirección"
            />
            <button type="submit">Buscar</button>
          </div>
        </form>

        <div className="clients-filter">
          <label htmlFor="client-status">Estado</label>
          <select
            id="client-status"
            value={statusFilter}
            onChange={(event) =>
              handleStatusChange(event.target.value as StatusFilter)
            }
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="clients-feedback clients-feedback--error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void loadClients()}>
            Reintentar
          </button>
        </div>
      )}

      <div className="clients-list-wrapper" aria-busy={loading}>
        {loading ? (
          <p className="clients-feedback">Cargando clientes…</p>
        ) : items.length === 0 ? (
          <div className="clients-feedback">
            <h2>No hay clientes para mostrar</h2>
            <p>
              {search || statusFilter !== "all"
                ? "Probá cambiar la búsqueda o el filtro."
                : "Todavía no hay clientes registrados."}
            </p>
          </div>
        ) : (
          <>
            <div className="clients-list-header" aria-hidden="true">
              <span>Nombre</span>
              <span>Teléfono</span>
              <span>Dirección</span>
              <span>Estado</span>
            </div>
            <ul className="clients-list" aria-label="Listado de clientes">
              {items.map((client) => (
                <li key={client.id}>
                  <button
                    className="client-row"
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    aria-label={`Abrir ficha de ${client.name}`}
                  >
                    <strong>{client.name}</strong>
                    <span>{client.phone ?? "—"}</span>
                    <span>{client.address ?? "—"}</span>
                    <span>
                      <span
                        className={`clients-status clients-status--${
                          client.active ? "active" : "inactive"
                        }`}
                      >
                        {client.active ? "Activo" : "Inactivo"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {!loading && total > 0 && (
        <nav className="clients-pagination" aria-label="Paginación de clientes">
          <span>
            Página {page} de {totalPages} · {total} cliente{total === 1 ? "" : "s"}
          </span>
          <div>
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </button>
          </div>
        </nav>
      )}

      <ClientDrawer
        mode={createDrawerOpen ? "create" : "edit"}
        clientId={createDrawerOpen ? null : selectedClientId}
        onClose={handleCloseDrawer}
        onCreated={handleClientCreated}
        onSaved={handleClientSaved}
      />
    </section>
  );
}
