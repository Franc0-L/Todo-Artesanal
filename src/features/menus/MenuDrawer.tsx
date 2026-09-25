import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useConfirm } from "../../components/ui/useConfirm";
import { formatCurrency, formatDate } from "../../lib/formatters";
import { listDishes } from "../platos/services/dishes.service";
import { listDishVersions } from "../platos/services/dish-versions.service";
import { createMenu, getMenu, setMenuActive } from "./services/menus.service";
import {
  createMenuVersion,
  listMenuVersions,
} from "./services/menu-versions.service";
import type { Menu, MenuWithCurrentVersion } from "./types/menu";
import type { MenuVersionSummary } from "./types/menu-version";
import type { MenuVersionItem } from "./types/menu-version-item";
import type { MenuItemRole } from "../../types/domain";

interface Props {
  mode: "create" | "edit";
  menuId: string | null;
  onClose: () => void;
  onCreated: (menu: MenuWithCurrentVersion) => void;
  onSaved: (menu: Menu) => void;
}
interface FormState {
  name: string;
  price: string;
  items: MenuVersionItem[];
}
interface DishOption {
  id: string;
  name: string;
  versionId: string;
  versionNumber: number;
  price: number;
}
const EMPTY: FormState = { name: "", price: "", items: [] };

export function MenuDrawer({
  mode,
  menuId,
  onClose,
  onCreated,
  onSaved,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuWithCurrentVersion | null>(null);
  const [versions, setVersions] = useState<MenuVersionSummary[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [options, setOptions] = useState<DishOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  const createMode = mode === "create";

  const dirty = createMode
    ? Boolean(form.name.trim() || form.price.trim() || form.items.length)
    : !!menu?.currentVersion &&
      (form.name !== menu.currentVersion.name ||
        form.price !== String(menu.currentVersion.price) ||
        JSON.stringify(form.items.map((i) => [i.dishVersion.id, i.role])) !==
          JSON.stringify(
            menu.currentVersion.items.map((i) => [i.dishVersion.id, i.role]),
          ));

  const reset = useCallback(() => {
    setMenu(null);
    setVersions([]);
    setForm(EMPTY);
    setOptions([]);
    setSearch("");
    setError(null);
    setMessage(null);
  }, []);

  useEffect(() => {
    if (createMode) {
      reset();
      return;
    }
    if (!menuId) {
      reset();
      return;
    }
    let cancelled = false;
    setLoading(true);
    reset();
    void Promise.all([getMenu(menuId), listMenuVersions(menuId)])
      .then(([m, v]) => {
        if (cancelled) return;
        setMenu(m);
        setForm(
          m.currentVersion
            ? {
                name: m.currentVersion.name,
                price: String(m.currentVersion.price),
                items: m.currentVersion.items,
              }
            : EMPTY,
        );
        setVersions(v);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el menú.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createMode, menuId, reset]);

  useEffect(() => {
    if (!createMode && !menuId) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = old;
    };
  }, [createMode, menuId]);

  const requestClose = useCallback(async () => {
    if (
      dirty &&
      !(await confirm({
        title: "Cambios sin guardar",
        message: "Hay cambios sin guardar. Si cerrás ahora se perderán.",
        confirmLabel: "Cerrar sin guardar",
        cancelLabel: "Seguir editando",
        tone: "danger",
      }))
    )
      return;
    onClose();
  }, [confirm, dirty, onClose]);

  useEffect(() => {
    if (!createMode && !menuId) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") void requestClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [createMode, menuId, requestClose]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setOptionsLoading(true);
      void listDishes({
        search: search || undefined,
        active: true,
        page: 1,
        pageSize: 50,
      })
        .then(async (result) => {
          const resolved = await Promise.all(
            result.items
              .filter((d) => d.name)
              .map(async (d) => {
                const v = (await listDishVersions(d.id))[0];
                return v
                  ? {
                      id: d.id,
                      name: d.name as string,
                      versionId: v.id,
                      versionNumber: v.versionNumber,
                      price: v.price,
                    }
                  : null;
              }),
          );
          if (!cancelled)
            setOptions(resolved.filter((x): x is DishOption => !!x));
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setOptionsLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  function add(option: DishOption, role: MenuItemRole) {
    if (form.items.some((i) => i.dishVersion.id === option.versionId)) return;
    if (role === "main" && form.items.some((i) => i.role === "main")) return;
    const item: MenuVersionItem = {
      id: `draft-${option.versionId}`,
      menuVersionId: menu?.currentVersion?.id ?? "draft",
      role,
      createdAt: new Date().toISOString(),
      dishVersion: {
        id: option.versionId,
        dishId: option.id,
        versionNumber: option.versionNumber,
        name: option.name,
        price: option.price,
      },
    };
    setForm((f) => ({ ...f, items: [...f.items, item] }));
  }
  function remove(id: string) {
    setForm((f) => ({
      ...f,
      items: f.items.filter((i) => i.dishVersion.id !== id),
    }));
  }
  function changeRole(id: string, value: MenuItemRole) {
    setForm((f) => ({
      ...f,
      items: f.items.map((i) =>
        i.dishVersion.id === id ? { ...i, role: value } : i,
      ),
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const price = Number(form.price);
      const main = form.items.filter((i) => i.role === "main").length;
      if (!form.name.trim())
        throw new Error("El nombre del menú es obligatorio.");
      if (!Number.isFinite(price) || price < 0)
        throw new Error("El precio debe ser un número mayor o igual a 0.");
      if (main !== 1)
        throw new Error("El menú debe tener exactamente un plato principal.");
      const items = form.items.map((i) => ({
        dishVersionId: i.dishVersion.id,
        role: i.role,
      }));
      if (createMode) {
        onCreated(await createMenu({ name: form.name, price, items }));
        return;
      }
      if (!menu) return;
      const created = await createMenuVersion(menu.id, {
        name: form.name,
        price,
        items,
      });
      const updated = { ...menu, currentVersion: created };
      setMenu(updated);
      setVersions((v) => [
        {
          id: created.id,
          menuId: created.menuId,
          versionNumber: created.versionNumber,
          name: created.name,
          price: created.price,
          createdAt: created.createdAt,
        },
        ...v,
      ]);
      setForm({
        name: created.name,
        price: String(created.price),
        items: created.items,
      });
      setMessage(`Versión ${created.versionNumber} creada.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el menú.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!menu) return;
    const active = !menu.active;
    const ok = await confirm({
      title: active ? "Activar menú" : "Desactivar menú",
      message: active
        ? "¿Activar este menú?"
        : "¿Desactivar este menú? Su historial se conservará.",
      confirmLabel: active ? "Activar" : "Desactivar",
      tone: active ? "default" : "danger",
    });
    if (!ok) return;
    try {
      const updated = await setMenuActive(menu.id, active);
      setMenu((m) => (m ? { ...m, ...updated } : m));
      onSaved(updated);
      setMessage(active ? "Menú activado." : "Menú desactivado.");
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "No se pudo actualizar el estado.",
      );
    }
  }

  if (!createMode && !menuId) return null;
  return (
    <>
      <div
        className="menu-drawer__backdrop"
        onMouseDown={() => void requestClose()}
      >
        <aside
          className="menu-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-drawer-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="menu-drawer__header">
            <div>
              <p className="menus-page__eyebrow">
                {createMode ? "Nuevo menú" : "Ficha de menú"}
              </p>
              <h2 id="menu-drawer-title">
                {createMode ? "Crear menú" : form.name || "Menú"}
              </h2>
            </div>
            <button
              ref={closeRef}
              className="menu-drawer__close"
              type="button"
              onClick={() => void requestClose()}
              aria-label="Cerrar ficha"
            >
              ×
            </button>
          </header>
          <div className="menu-drawer__body">
            {loading && <p className="menus-feedback">Cargando ficha…</p>}
            {error && (
              <p className="menus-feedback menus-feedback--error" role="alert">
                {error}
              </p>
            )}
            {!loading && (createMode || menu) && (
              <form className="menu-form" onSubmit={submit}>
                {menu && (
                  <section className="menu-form__summary">
                    <span
                      className={`menus-status menus-status--${menu.active ? "active" : "inactive"}`}
                    >
                      {menu.active ? "Activo" : "Inactivo"}
                    </span>
                    <button
                      type="button"
                      className="menu-form__secondary-action"
                      onClick={() => void toggleActive()}
                    >
                      {menu.active ? "Desactivar menú" : "Activar menú"}
                    </button>
                  </section>
                )}
                <div className="menu-form__fields">
                  <label>
                    Nombre
                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Precio
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.price}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, price: e.target.value }))
                      }
                      required
                    />
                  </label>
                </div>
                <section className="menu-form__section">
                  <div className="menu-form__section-header">
                    <div>
                      <p className="menus-page__eyebrow">Composición</p>
                      <h3>
                        {createMode ? "Primera versión" : "Nueva versión"}
                      </h3>
                    </div>
                    <span>
                      {form.items.length} ítem
                      {form.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <input
                    className="menu-dish-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar platos activos…"
                    aria-label="Buscar platos activos"
                  />
                  {optionsLoading && <small>Buscando platos…</small>}
                  {!optionsLoading && options.length > 0 && (
                    <div className="menu-dish-options">
                      {options.slice(0, 8).map((o) => (
                        <div className="menu-dish-option" key={o.versionId}>
                          <div>
                            <strong>{o.name}</strong>
                            <span>
                              v{o.versionNumber} · {formatCurrency(o.price)}
                            </span>
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => add(o, "main")}
                              disabled={
                                form.items.some(
                                  (i) => i.dishVersion.id === o.versionId,
                                ) || form.items.some((i) => i.role === "main")
                              }
                            >
                              Principal
                            </button>
                            <button
                              type="button"
                              onClick={() => add(o, "side")}
                              disabled={form.items.some(
                                (i) => i.dishVersion.id === o.versionId,
                              )}
                            >
                              Guarnición
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="menu-selected-items">
                    {form.items.map((i) => (
                      <article
                        className="menu-selected-item"
                        key={i.dishVersion.id}
                      >
                        <div>
                          <strong>{i.dishVersion.name}</strong>
                          <span>
                            v{i.dishVersion.versionNumber} ·{" "}
                            {formatCurrency(i.dishVersion.price)}
                          </span>
                        </div>
                        <div>
                          <select
                            value={i.role}
                            onChange={(e) =>
                              changeRole(
                                i.dishVersion.id,
                                e.target.value as MenuItemRole,
                              )
                            }
                            aria-label={`Rol de ${i.dishVersion.name}`}
                          >
                            <option value="main">Principal</option>
                            <option value="side">Guarnición</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => remove(i.dishVersion.id)}
                          >
                            Quitar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                {!createMode && versions.length > 0 && (
                  <section className="menu-form__section">
                    <div className="menu-form__section-header">
                      <div>
                        <p className="menus-page__eyebrow">Historial</p>
                        <h3>Versiones</h3>
                      </div>
                    </div>
                    <div className="menu-version-list">
                      {versions.map((v) => (
                        <article key={v.id}>
                          <div>
                            <strong>
                              v{v.versionNumber} — {v.name}
                            </strong>
                            <span>
                              {formatCurrency(v.price)} ·{" "}
                              {formatDate(v.createdAt)}
                            </span>
                          </div>
                          {v.id === menu?.currentVersion?.id && <b>Actual</b>}
                        </article>
                      ))}
                    </div>
                  </section>
                )}
                {message && (
                  <p className="menu-form__message" role="status">
                    {message}
                  </p>
                )}
                <footer className="menu-form__actions">
                  <button
                    className="menu-form__secondary-action"
                    type="button"
                    onClick={() => void requestClose()}
                  >
                    Cancelar
                  </button>
                  <button
                    className="menu-form__primary-action"
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? "Guardando…"
                      : createMode
                        ? "Crear menú"
                        : "Crear nueva versión"}
                  </button>
                </footer>
              </form>
            )}
          </div>
        </aside>
      </div>
      {confirmDialog}
    </>
  );
}
