import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  getUnansweredClients,
  listHistoricalWeeks,
} from "./services/history.service";
import type { HistoricalWeek } from "./types/historical-week";
import type { UnansweredClient } from "./types/unanswered";
import "./history.css";

const PAGE_SIZE = 10;
const UNANSWERED_PAGE_SIZE = 50;

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);
}

export function HistoryPage() {
  const [items, setItems] = useState<HistoricalWeek[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [unanswered, setUnanswered] = useState<UnansweredClient[]>([]);
  const [unansweredLoading, setUnansweredLoading] = useState(false);
  const [unansweredError, setUnansweredError] = useState<string | null>(null);
  const unansweredRequestRef = useRef(0);

  const loadWeeks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listHistoricalWeeks({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
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
          : "No se pudo cargar el historial.",
      );
    } finally {
      setLoading(false);
    }
  }, [fromDate, page, toDate]);

  useEffect(() => {
    void loadWeeks();
  }, [loadWeeks]);

  const openUnanswered = useCallback(async (week: HistoricalWeek) => {
    const requestId = unansweredRequestRef.current + 1;
    unansweredRequestRef.current = requestId;

    setSelectedWeekId(week.id);
    setUnanswered([]);
    setUnansweredError(null);

    if (week.unansweredClientCount === 0) {
      setUnansweredLoading(false);
      return;
    }

    setUnansweredLoading(true);
    try {
      const result = await getUnansweredClients(week.id, {
        page: 1,
        pageSize: UNANSWERED_PAGE_SIZE,
      });

      if (unansweredRequestRef.current !== requestId) return;
      setUnanswered(result.items);
    } catch (loadError) {
      if (unansweredRequestRef.current !== requestId) return;
      setUnansweredError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los clientes sin responder.",
      );
    } finally {
      if (unansweredRequestRef.current === requestId) {
        setUnansweredLoading(false);
      }
    }
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedWeek = items.find((week) => week.id === selectedWeekId) ?? null;

  function handleFiltersSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  return (
    <section className="history-page" aria-labelledby="history-title">
      <header className="history-page__header">
        <div>
          <p className="history-page__eyebrow">Administración</p>
          <h1 id="history-title">Historial</h1>
          <p className="history-page__description">
            Consultá las semanas cerradas y sus resultados históricos.
          </p>
        </div>
      </header>

      <form className="history-filters" onSubmit={handleFiltersSubmit}>
        <div>
          <label htmlFor="history-from">Desde</label>
          <input
            id="history-from"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="history-to">Hasta</label>
          <input
            id="history-to"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
        <button type="submit">Aplicar filtros</button>
      </form>

      {error && (
        <div className="history-feedback history-feedback--error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void loadWeeks()}>
            Reintentar
          </button>
        </div>
      )}

      <div className="history-list" aria-busy={loading}>
        {loading ? (
          <p className="history-feedback">Cargando historial…</p>
        ) : items.length === 0 ? (
          <div className="history-feedback">
            <h2>No hay semanas históricas</h2>
            <p>Las semanas aparecen acá una vez que fueron cerradas.</p>
          </div>
        ) : (
          <>
            <div className="history-list__header" aria-hidden="true">
              <span>Semana</span>
              <span>Pedidos</span>
              <span>Viandas</span>
              <span>Total</span>
              <span>Cancelaciones</span>
              <span>Sin responder</span>
            </div>
            <ul aria-label="Semanas históricas">
              {items.map((week) => (
                <li key={week.id}>
                  <article className="history-week-row">
                    <div>
                      <strong>
                        {formatDate(week.startDate)} —{" "}
                        {formatDate(week.endDate)}
                      </strong>
                      <span>{week.expectedClientCount} clientes esperados</span>
                    </div>
                    <span>{week.orderCount}</span>
                    <span>{week.totalQuantity}</span>
                    <strong>{formatAmount(week.totalAmount)}</strong>
                    <span>{week.cancellationCount}</span>
                    <button
                      type="button"
                      className={
                        week.unansweredClientCount > 0
                          ? "history-unanswered-button"
                          : "history-unanswered-button history-unanswered-button--empty"
                      }
                      disabled={week.unansweredClientCount === 0}
                      onClick={() => void openUnanswered(week)}
                    >
                      {week.unansweredClientCount}
                    </button>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {!loading && total > 0 && (
        <nav
          className="history-pagination"
          aria-label="Paginación del historial"
        >
          <span>
            Página {page} de {totalPages} · {total} semana
            {total === 1 ? "" : "s"}
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

      {selectedWeek && (
        <div className="history-overlay" role="presentation">
          <aside
            className="history-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-drawer-title"
          >
            <header>
              <div>
                <p>Semana cerrada</p>
                <h2 id="history-drawer-title">
                  {formatDate(selectedWeek.startDate)} —{" "}
                  {formatDate(selectedWeek.endDate)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  unansweredRequestRef.current += 1;
                  setSelectedWeekId(null);
                  setUnansweredLoading(false);
                }}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>

            <dl className="history-summary">
              <div>
                <dt>Pedidos</dt>
                <dd>{selectedWeek.orderCount}</dd>
              </div>
              <div>
                <dt>Viandas</dt>
                <dd>{selectedWeek.totalQuantity}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{formatAmount(selectedWeek.totalAmount)}</dd>
              </div>
              <div>
                <dt>Cancelaciones</dt>
                <dd>{selectedWeek.cancellationCount}</dd>
              </div>
            </dl>

            <section aria-labelledby="history-unanswered-title">
              <h3 id="history-unanswered-title">Clientes sin responder</h3>
              {unansweredLoading ? (
                <p className="history-feedback">Cargando…</p>
              ) : unansweredError ? (
                <p
                  className="history-feedback history-feedback--error"
                  role="alert"
                >
                  {unansweredError}
                </p>
              ) : unanswered.length === 0 ? (
                <p className="history-feedback">
                  Todos los clientes esperados respondieron.
                </p>
              ) : (
                <ul className="history-unanswered-list">
                  {unanswered.map((client) => (
                    <li key={client.clientId}>
                      <strong>
                        {client.client?.name ?? "Cliente sin nombre"}
                      </strong>
                      <span>{client.client?.phone ?? "Sin teléfono"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}
