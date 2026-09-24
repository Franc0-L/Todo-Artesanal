import { useEffect, useRef, useState } from "react";
import { getClient } from "./services/clients.service";
import type { Client } from "./types/client";

interface ClientDrawerProps {
  clientId: string | null;
  onClose: () => void;
}

export function ClientDrawer({ clientId, onClose }: ClientDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) {
      setClient(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setClient(null);
    setError(null);

    void getClient(clientId)
      .then((result) => {
        if (!cancelled) {
          setClient(result);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar la ficha del cliente.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clientId, onClose]);

  if (!clientId) {
    return null;
  }

  return (
    <div className="client-drawer__backdrop" onMouseDown={onClose}>
      <aside
        className="client-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="client-drawer__header">
          <div>
            <p className="clients-page__eyebrow">Ficha de cliente</p>
            <h2 id="client-drawer-title">{client?.name ?? "Cliente"}</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="client-drawer__close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar ficha del cliente"
          >
            ×
          </button>
        </header>

        <div className="client-drawer__body">
          {loading && <p className="clients-feedback">Cargando ficha…</p>}

          {!loading && error && (
            <div className="clients-feedback clients-feedback--error" role="alert">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && client && (
            <dl className="client-details">
              <div>
                <dt>Estado</dt>
                <dd>{client.active ? "Activo" : "Inactivo"}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{client.phone ?? "No informado"}</dd>
              </div>
              <div>
                <dt>Dirección</dt>
                <dd>{client.address ?? "No informada"}</dd>
              </div>
              <div>
                <dt>Cuidados especiales</dt>
                <dd>{client.specialCare ?? "Ninguno informado"}</dd>
              </div>
              <div>
                <dt>Media vianda habilitada</dt>
                <dd>{client.allowsHalfPortion ? "Sí" : "No"}</dd>
              </div>
              <div>
                <dt>Observaciones</dt>
                <dd>{client.notes ?? "Sin observaciones"}</dd>
              </div>
            </dl>
          )}
        </div>
      </aside>
    </div>
  );
}
