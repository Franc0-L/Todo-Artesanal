import { useCallback, useEffect, useState } from "react";
import { setSearchParams, useQueryParam } from "../../app/query";
import { MODALITY_LABELS } from "../../lib/labels";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  formatCurrency,
  formatDate,
  formatDateRange,
} from "../../lib/formatters";
import { DAY_LABELS } from "../semanas/day-labels";
import { getActiveWeek, listWeeks } from "../semanas/services/weeks.service";
import { getWeekReport } from "./services/reports.service";
import type { DayOfWeek, WeekStatus } from "../../types/domain";
import type { WeekListItem } from "../semanas/types/week-list";
import type { WeekReport, WeekReportProductRow } from "./types/week-report";
import "./reportes.css";

function weekStatusLabel(status: WeekStatus): string {
  if (status === "active") return "activa";
  if (status === "draft") return "borrador";
  return "cerrada";
}

function dayLabel(dayOfWeek: number): string {
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    return DAY_LABELS[dayOfWeek as DayOfWeek];
  }

  return "—";
}

/** Etiqueta del origen del producto: opción de oferta o ítem de catálogo. */
function productOriginLabel(row: WeekReportProductRow): string {
  if (row.source === "option") {
    return row.optionType === "menu" ? "Menú" : "Plato";
  }

  return row.source === "menu" ? "Menú · catálogo" : "Plato · catálogo";
}

export function ReportesPage() {
  const [weeks, setWeeks] = useState<WeekListItem[]>([]);
  // La semana elegida vive en la URL (query `semana`).
  const weekId = useQueryParam("semana") ?? "";
  const [weeksLoading, setWeeksLoading] = useState(true);
  const [weeksError, setWeeksError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // El reporte se guarda junto a la clave de la consulta que lo pidió: el
  // `loading`, el error y el reporte visible se derivan en el render.
  const requestKey = `${weekId}|${reloadToken}`;
  const [result, setResult] = useState<{
    key: string;
    report: WeekReport;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);

  const report = result?.key === requestKey ? result.report : null;
  const loading = weekId !== "" && result?.key !== requestKey;
  const reportError = failure?.key === requestKey ? failure.message : null;
  const visibleError = reportError ?? weeksError;

  const reload = useCallback(() => {
    setWeeksError(null);
    setReloadToken((current) => current + 1);
  }, []);

  // `weeksLoading` arranca en `true` y baja dentro del callback: el efecto no
  // fija estado de forma sincrónica.
  useEffect(() => {
    let cancelled = false;

    void Promise.all([listWeeks({ pageSize: 100 }), getActiveWeek()])
      .then(([weeksResult, active]) => {
        if (cancelled) return;
        setWeeks(weeksResult.items);
        if (!new URLSearchParams(window.location.search).get("semana")) {
          const fallback = active?.id ?? weeksResult.items[0]?.id ?? "";
          if (fallback) {
            setSearchParams({ semana: fallback }, { replace: true });
          }
        }
        setWeeksError(null);
      })
      .catch((weeksFailure: unknown) => {
        if (cancelled) return;
        setWeeksError(
          weeksFailure instanceof Error
            ? weeksFailure.message
            : "No se pudieron cargar las semanas.",
        );
      })
      .finally(() => {
        if (!cancelled) setWeeksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!weekId) return;
    let cancelled = false;

    void getWeekReport(weekId)
      .then((loaded) => {
        if (cancelled) return;
        setResult({ key: requestKey, report: loaded });
        setFailure(null);
      })
      .catch((loadFailure: unknown) => {
        if (cancelled) return;
        setFailure({
          key: requestKey,
          message:
            loadFailure instanceof Error
              ? loadFailure.message
              : "No se pudo cargar el reporte.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, weekId]);

  const hasOrders = (report?.totals.orderCount ?? 0) > 0;

  return (
    <section className="reportes-page" aria-labelledby="reportes-title">
      <header className="reportes-page__header">
        <p className="reportes-page__eyebrow">Administración</p>
        <h1 id="reportes-title">Reportes</h1>
        <p className="reportes-page__description">
          Montos consolidados de una semana. Los importes salen del precio
          congelado en cada pedido: cambiar precios hoy no altera el pasado.
        </p>
      </header>

      <div className="reportes-filters">
        <div className="reportes-filters__field">
          <label htmlFor="reportes-semana">Semana</label>
          <select
            id="reportes-semana"
            value={weekId}
            onChange={(event) => {
              setWeeksError(null);
              setSearchParams({ semana: event.target.value });
            }}
            disabled={weeksLoading || weeks.length === 0}
          >
            {weeks.length === 0 && <option value="">Sin semanas</option>}
            {weeks.map((week) => (
              <option key={week.id} value={week.id}>
                {formatDateRange(week.startDate, week.endDate)} ·{" "}
                {weekStatusLabel(week.status)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="reportes-filters__reload"
          onClick={reload}
          disabled={!weekId || loading}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {visibleError && (
        <p className="reportes-feedback reportes-feedback--error" role="alert">
          {visibleError}
        </p>
      )}

      {loading && (
        <p className="reportes-feedback" aria-live="polite">
          Cargando reporte…
        </p>
      )}

      {!loading && !visibleError && !report && (
        <EmptyState
          mascot="degustacion"
          title="No hay semanas para reportar"
          description="Creá una semana y activala para ver acá sus montos consolidados."
        />
      )}

      {!loading && !visibleError && report && (
        <>
          <ul className="reportes-cards">
            <li className="reportes-card">
              <span className="reportes-card__label">Monto total</span>
              <strong className="reportes-card__value reportes-num">
                {formatCurrency(report.totals.totalAmount)}
              </strong>
            </li>
            <li className="reportes-card">
              <span className="reportes-card__label">Viandas</span>
              <strong className="reportes-card__value reportes-num">
                {report.totals.totalQuantity}
              </strong>
            </li>
            <li className="reportes-card">
              <span className="reportes-card__label">Pedidos</span>
              <strong className="reportes-card__value reportes-num">
                {report.totals.orderCount}
              </strong>
            </li>
            <li className="reportes-card">
              <span className="reportes-card__label">Cancelaciones</span>
              <strong className="reportes-card__value reportes-num">
                {report.totals.cancellationCount}
              </strong>
            </li>
            <li className="reportes-card">
              <span className="reportes-card__label">Sin responder</span>
              <strong className="reportes-card__value reportes-num">
                {report.totals.unansweredClientCount}
              </strong>
              <span className="reportes-card__hint">
                de {report.totals.expectedClientCount} esperados
              </span>
            </li>
          </ul>

          {!hasOrders && (
            <EmptyState
              mascot="preparacion"
              title="La semana todavía no tiene pedidos"
              description="Cuando los clientes pidan, acá aparecen los montos por día, modalidad, producto y cliente."
            />
          )}

          {hasOrders && (
            <div className="reportes-tables">
              <section
                className="reportes-table-card"
                aria-labelledby="reportes-por-dia"
              >
                <h2 id="reportes-por-dia">Por día</h2>
                <div className="reportes-table-wrapper">
                  <table className="reportes-table">
                    <thead>
                      <tr>
                        <th scope="col">Día</th>
                        <th scope="col" className="reportes-num">
                          Pedidos
                        </th>
                        <th scope="col" className="reportes-num">
                          Viandas
                        </th>
                        <th scope="col" className="reportes-num">
                          Cancelaciones
                        </th>
                        <th scope="col" className="reportes-num">
                          Sin responder
                        </th>
                        <th scope="col" className="reportes-num">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byDay.map((day) => (
                        <tr key={day.weekDayId}>
                          <th scope="row">
                            {dayLabel(day.dayOfWeek)}
                            <span className="reportes-table__date">
                              {formatDate(day.date)}
                            </span>
                          </th>
                          <td className="reportes-num">{day.orderCount}</td>
                          <td className="reportes-num">{day.quantity}</td>
                          <td className="reportes-num">
                            {day.cancellationCount}
                          </td>
                          <td className="reportes-num">
                            {day.unansweredCount}
                          </td>
                          <td className="reportes-num">
                            {formatCurrency(day.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section
                className="reportes-table-card"
                aria-labelledby="reportes-por-modalidad"
              >
                <h2 id="reportes-por-modalidad">Por modalidad</h2>
                <div className="reportes-table-wrapper">
                  <table className="reportes-table">
                    <thead>
                      <tr>
                        <th scope="col">Modalidad</th>
                        <th scope="col" className="reportes-num">
                          Pedidos
                        </th>
                        <th scope="col" className="reportes-num">
                          Viandas
                        </th>
                        <th scope="col" className="reportes-num">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byModality.map((row) => (
                        <tr key={row.modality}>
                          <th scope="row">
                            <span
                              className={`reportes-chip reportes-chip--${row.modality}`}
                            >
                              {MODALITY_LABELS[row.modality]}
                            </span>
                          </th>
                          <td className="reportes-num">{row.orderCount}</td>
                          <td className="reportes-num">{row.quantity}</td>
                          <td className="reportes-num">
                            {formatCurrency(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section
                className="reportes-table-card"
                aria-labelledby="reportes-por-producto"
              >
                <h2 id="reportes-por-producto">Por producto</h2>
                <div className="reportes-table-wrapper">
                  <table className="reportes-table">
                    <thead>
                      <tr>
                        <th scope="col">Producto</th>
                        <th scope="col">Modalidad</th>
                        <th scope="col" className="reportes-num">
                          Pedidos
                        </th>
                        <th scope="col" className="reportes-num">
                          Viandas
                        </th>
                        <th scope="col" className="reportes-num">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byProduct.map((row) => (
                        <tr
                          key={`${row.source}|${row.optionType ?? ""}|${row.name}|${row.modality}`}
                        >
                          <th scope="row">
                            <span
                              className={`reportes-chip reportes-chip--${row.source}`}
                            >
                              {productOriginLabel(row)}
                            </span>
                            {row.name}
                          </th>
                          <td>
                            <span
                              className={`reportes-chip reportes-chip--${row.modality}`}
                            >
                              {MODALITY_LABELS[row.modality]}
                            </span>
                          </td>
                          <td className="reportes-num">{row.orderCount}</td>
                          <td className="reportes-num">{row.quantity}</td>
                          <td className="reportes-num">
                            {formatCurrency(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section
                className="reportes-table-card"
                aria-labelledby="reportes-por-cliente"
              >
                <h2 id="reportes-por-cliente">Por cliente</h2>
                <div className="reportes-table-wrapper">
                  <table className="reportes-table">
                    <thead>
                      <tr>
                        <th scope="col">Cliente</th>
                        <th scope="col" className="reportes-num">
                          Pedidos
                        </th>
                        <th scope="col" className="reportes-num">
                          Viandas
                        </th>
                        <th scope="col" className="reportes-num">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byClient.map((row) => (
                        <tr key={row.clientId}>
                          <th scope="row">{row.name}</th>
                          <td className="reportes-num">{row.orderCount}</td>
                          <td className="reportes-num">{row.quantity}</td>
                          <td className="reportes-num">
                            {formatCurrency(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section
                className="reportes-table-card"
                aria-labelledby="reportes-sin-responder"
              >
                <h2 id="reportes-sin-responder">Sin responder</h2>
                {report.unanswered.length === 0 ? (
                  <p className="reportes-table__empty">
                    Todos los clientes esperados respondieron.
                  </p>
                ) : (
                  <ul className="reportes-unanswered">
                    {report.unanswered.map((client) => (
                      <li key={client.clientId}>{client.name}</li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </section>
  );
}
