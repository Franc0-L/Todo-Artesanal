import { useEffect, useRef, useState, type FormEvent } from "react";
import { getClient, updateClient } from "./services/clients.service";
import type { Client, UpdateClientInput } from "./types/client";

interface ClientDrawerProps {
  clientId: string | null;
  onClose: () => void;
  onSaved: (client: Client) => void;
}

interface ClientFormState {
  name: string;
  phone: string;
  address: string;
  notes: string;
  specialCare: string;
  allowsHalfPortion: boolean;
}

const EMPTY_FORM: ClientFormState = {
  name: "",
  phone: "",
  address: "",
  notes: "",
  specialCare: "",
  allowsHalfPortion: false,
};

function toFormState(client: Client): ClientFormState {
  return {
    name: client.name,
    phone: client.phone ?? "",
    address: client.address ?? "",
    notes: client.notes ?? "",
    specialCare: client.specialCare ?? "",
    allowsHalfPortion: client.allowsHalfPortion,
  };
}

export function ClientDrawer({ clientId, onClose, onSaved }: ClientDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const dirty = client
    ? form.name !== client.name ||
      form.phone !== (client.phone ?? "") ||
      form.address !== (client.address ?? "") ||
      form.notes !== (client.notes ?? "") ||
      form.specialCare !== (client.specialCare ?? "") ||
      form.allowsHalfPortion !== client.allowsHalfPortion
    : false;

  useEffect(() => {
    if (!clientId) {
      setClient(null);
      setForm(EMPTY_FORM);
      setError(null);
      setSaveMessage(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setClient(null);
    setForm(EMPTY_FORM);
    setError(null);
    setSaveMessage(null);

    void getClient(clientId)
      .then((result) => {
        if (!cancelled) {
          setClient(result);
          setForm(toFormState(result));
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

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [clientId]);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (dirty && !window.confirm("Hay cambios sin guardar. ¿Cerrar la ficha?")) {
        return;
      }

      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clientId, dirty, onClose]);

  function requestClose() {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Cerrar la ficha?")) {
      return;
    }

    onClose();
  }

  function updateField<K extends keyof ClientFormState>(
    field: K,
    value: ClientFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!client || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    const input: UpdateClientInput = {
      name: form.name,
      phone: form.phone,
      address: form.address,
      notes: form.notes,
      specialCare: form.specialCare,
      allowsHalfPortion: form.allowsHalfPortion,
    };

    try {
      const updated = await updateClient(client.id, input);
      setClient(updated);
      setForm(toFormState(updated));
      setSaveMessage("Cambios guardados.");
      onSaved(updated);
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudieron guardar los cambios.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!clientId) {
    return null;
  }

  return (
    <div className="client-drawer__backdrop" onMouseDown={requestClose}>
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
            onClick={requestClose}
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
              <button type="button" onClick={() => setError(null)}>
                Cerrar aviso
              </button>
            </div>
          )}

          {!loading && client && (
            <form className="client-form" onSubmit={handleSubmit}>
              <div className="client-form__summary" aria-label="Datos básicos del cliente">
                <span className={`clients-status clients-status--${client.active ? "active" : "inactive"}`}>
                  {client.active ? "Activo" : "Inactivo"}
                </span>
                <p>{client.phone ?? "Teléfono no informado"}</p>
                <p>{client.address ?? "Dirección no informada"}</p>
              </div>

              <div className="client-form__fields">
                <label>
                  Nombre
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    required
                    autoComplete="name"
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    autoComplete="tel"
                  />
                </label>
                <label>
                  Dirección
                  <input
                    type="text"
                    value={form.address}
                    onChange={(event) => updateField("address", event.target.value)}
                    autoComplete="street-address"
                  />
                </label>
                <label>
                  Cuidados especiales
                  <textarea
                    value={form.specialCare}
                    onChange={(event) => updateField("specialCare", event.target.value)}
                    rows={3}
                  />
                </label>
                <label>
                  Observaciones
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    rows={4}
                  />
                </label>
                <label className="client-form__checkbox">
                  <input
                    type="checkbox"
                    checked={form.allowsHalfPortion}
                    onChange={(event) => updateField("allowsHalfPortion", event.target.checked)}
                  />
                  <span>Permitir media vianda</span>
                </label>
              </div>

              {saveMessage && <p className="client-form__success" role="status">{saveMessage}</p>}

              <footer className="client-form__actions">
                <button type="button" onClick={requestClose} disabled={saving}>
                  Cerrar
                </button>
                <button type="submit" disabled={saving || !dirty}>
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </footer>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
