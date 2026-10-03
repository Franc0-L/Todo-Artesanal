# Developer & Agent Guidelines

## Commands

- **Typecheck**: `npx tsc -b`
- **Lint**: `npm run lint`
- **Build**: `npm run build` (`tsc -b && vite build`)
- **Format**: `npx prettier --write <file>`
  - ⚠️ El repo está en **CRLF** y no tiene `.prettierrc`: `prettier --check` sin flags marca archivos preexistentes por el fin de línea. Verificá con `npx prettier --check --end-of-line crlf <files>` (o formateá con `--write --end-of-line auto`).
- **Env/secretos**: `npm run env:init` (`scripts/setup-env.mjs`) — crea `.env.local` y deriva `supabase/.env.local` ↔ `supabase/signing_keys.json` desde las plantillas `.example` (nunca pisa archivos existentes). Los `.example` son la forma de cada secreto; el detalle y la checklist de migración de máquina están en `docs/entorno-y-secretos.md`.
- **Tests (Fase 7B, pendiente)**: `npx supabase test db` (pgTAP sobre el stack local; requiere Docker arriba).
- **Database Migrations**: `npx supabase db push --yes` (correr `--dry-run` primero)
  - **Cadena consolidada (2026-10-02):** las migraciones son **6 archivos de esquema por responsabilidad**:
    `20261002000001_schema`, `20261002000002_functions_private`, `20261002000003_triggers`,
    `20261002000004_rls`, `20261002000005_rpc_admin`, `20261002000006_rpc_client`.
    Reproducen exactamente el esquema final (validado: `db reset` + `pg_dump --schema-only` diff = 0 diferencias).
  - **Incremental posterior:** `20261002000007_rpc_reports` — `get_week_report(uuid) → jsonb`
    (montos consolidados de una semana; `security definer` guardado por `private.is_admin()`).
  - Proyecto Supabase linkeado: `zarvihhrzfcvlegqygnu` (las 6 migraciones ya aplicadas; local = remoto). La cadena vieja de 20 migraciones quedó en el repo `Todo-Artesanal-Legacy`.
  - La cadena ya incluye desde el esquema base: `offer_modality` (General/Opcional), producto único por semana, `validate_order` en modo normalización, `week_day_id` en `orders`/`cancellations` y `week_days.cutoff_at` (fuera de horario).
- **Generate Types**: `npx supabase gen types typescript --linked > src/types/database.ts`
  - ⚠️ **Never edit `src/types/database.ts` manually.**
- **Deploy Edge Function**: `npx supabase functions deploy <function-name>`
  - `authenticate-client-token` firma un JWT **ES256** con la signing key del proyecto: secrets `CLIENT_JWT_PRIVATE_KEY_JWK` + `CLIENT_JWT_KID`, clave **Active** en el panel (Auth → Signing Keys) y `key_ops` normalizado a `["sign"]` al importar la JWK. Ver `docs/decisiones/20261001-cliente-jwt-es256-signing-key.md`.

## Key Architecture & Domain Invariants

- **Routing Architecture**:
  - Custom lightweight routing in `src/app/AppRouter.tsx` and `src/app/routes.ts` (`window.history` + `useSyncExternalStore`).
  - **Do NOT install or look for `react-router` or third-party router libraries.**
- **Domain Isolation**:
  - `Semana / Oferta` (weekly offer) ≠ `Cliente` (current setup) ≠ `Pedido` (actual order with frozen prices) ≠ `Historial` (immutable history).
  - **Master Rule**: Subsequent modifications to current client setup or prices must **never** retroactively alter historical orders or facts.
  - **Media vianda**: `orders` has two mutually exclusive product sources — the day offer (`week_day_option_id`) or the catalog (`dish_version_id`/`menu_version_id`, media vianda only). `orders.week_day_id` is always present; `general`/`opcional` require the offer. The frontend never sends `applied_price` (the trigger computes it).
- **Security Boundary**:
  - RLS policies, triggers, and Postgres RPC functions are the true security boundary. Frontend checks are for UX only.
  - Admin authorization is checked against `private.admin_users` (`is_user_admin` RPC).
  - Client personal tokens are stored as SHA-256 hashes. Plaintext tokens are returned only once upon creation/rotation via `rotate-client-token`.

## Current System State & Boundaries

- **Implemented Areas**:
  - Database schema, RLS, triggers & RPCs in `supabase/migrations/`.
  - Service layer in `src/features/*/services/`.
  - Edge Functions `rotate-client-token` (issue personal link) and `authenticate-client-token` (link → ES256 JWT).
  - Admin UI for `/admin` (dashboard / inicio), `/admin/clientes`, `/admin/platos`, `/admin/menus`, `/admin/semanas`, `/admin/pedidos`, `/admin/cancelaciones`, `/admin/historial` y `/admin/reportes` (montos consolidados por semana vía el RPC `get_week_report`). `AdminSectionPage` is only an unknown-route fallback, no section uses it as a placeholder anymore.
- **WIP / Placeholders**:
  - `/menu/:token` client view: implemented end to end. `ClientSessionProvider` resolves the session, `useClientWeekData` loads the active week + offer + own orders/cancellations + own client + effective prices (all through the session's Supabase client), and `ClientDayCard` handles per-day ordering (create/update/delete order) and cancellation. `getWeekOffer`/`listDayOptions`/`listOrders`/`listCancellations`/`getClient` now accept a custom `SupabaseClient` (like `getActiveWeek`). Effective price preview comes from the RPC `calculate_my_order_price` (`20261002000006_rpc_client.sql`, `security definer`, identity from `private.current_client_id()`).
  - **Media vianda from the catalog** (done): client RLS does not expose `dishes`/`menus` (only versions belonging to the active week), so the catalog reaches the client through the RPC `list_client_catalog` (`20261002000006_rpc_client.sql`, `security definer`, `stable`, guarded by `private.current_client_id()`, granted to `authenticated`). `ClientCatalogPicker` loads it once and filters in memory; `ClientDayCard` then creates the order with `dishVersionId`/`menuVersionId` + `modality: 'media_vianda'`.
  - A day can hold **several orders** (the domain only forbids _identical_ ones: client + option + modality). `ClientDayCard` therefore keeps the existing order list visible _and_ keeps the option/catalog buttons available, disabling the combinations already ordered ("Ya pediste"); "No quiero ese día" is only offered when the day has no orders (the DB rejects a cancellation alongside orders).
  - **"Fuera de horario"** (done): per-day cutoff `week_days.cutoff_at` (default 20:00 the previous day, `America/Argentina/Buenos_Aires`). `private.enforce_client_day_cutoff` (triggers `orders_client_cutoff` / `cancellations_client_cutoff`, BEFORE INSERT OR UPDATE OR DELETE) rejects client responses after the cutoff; the admin is exempt (`current_client_id()` null). UI: `ClientDayCard` banner + disabled actions driven by `closedDayIds` (computed in `useClientWeekData`, plus an auto `reload()` scheduled at each cutoff in `ClientMenuPage`); per-day editor in `WeekWorkspace` (`updateWeekDayCutoff`). Decision: `docs/decisiones/20261001-fuera-de-horario-cutoff-por-dia.md`.
  - ADRs `001`–`005` are written (`versionado-inmutable`, `media-vianda-es-modalidad`, `precio-congelado-en-pedido`, `jwt-custom-para-clientes`, `semana-no-pertenece-a-cliente`). The only open item on the roadmap is **Fase 7B: tests de invariantes** (pgTAP + `npx supabase test db` sobre el stack local).

## Data Fetching & Effects (`react-hooks/set-state-in-effect`)

- **Nunca** fijar estado de forma sincrónica dentro de un `useEffect` (ni llamar a una función del componente que lo haga, ni envolverlo en una función local: el linter lo detecta igual). Regla práctica: el cuerpo del efecto solo dispara consultas y fija estado **dentro de callbacks** (`.then`, `.catch`, `.finally`, listeners).
- **Listados con filtros/paginación**: guardar el resultado junto a la clave de la consulta que lo pidió y derivar el resto en el render:
  - `const requestKey = \`${page}|${filtro}|${reloadToken}\``y`result`con forma`{ key, items, total }`.
  - `loading = result?.key !== requestKey`, `items = result?.key === requestKey ? result.items : []`, `error = failure?.key === requestKey ? failure.message : null`.
  - Refrescos con los mismos filtros (reintentar, post-crear, post-borrar) = `reload()` que incrementa `reloadToken`; nunca llamar al loader desde un evento.
  - Actualizaciones locales del listado (post-guardar) con un `patchItems` que respeta la clave vigente.
- **Drawers**: reiniciar el formulario por **remonte** (`key={"create" | \`edit:${id}\` | "closed"}`definido en la página) e inicializar`loading`en`useState(...)` según el modo; el efecto solo resuelve el fetch.
- Los efectos que consultan datos usan un flag `cancelled` en el cleanup (descarta respuestas de consultas ya reemplazadas).

## Theming & Mascot Assets

- **Semantic design tokens**: every color lives in `src/index.css` under `:root` (light) and `[data-theme="dark"]`. Component stylesheets **must not** hardcode hex values; use `var(--bg-surface)`, `var(--text-main)`, `var(--border-subtle)`, `var(--input-bg)`, `var(--drawer-bg)`, `var(--backdrop-color)`, etc. Adding a new theme means adding tokens, not new rules.
- **Theme manager**: `src/lib/theme.ts` (zero-dependency, `useSyncExternalStore` + `localStorage` + `prefers-color-scheme`).
- **Mascot assets**: `public/mascot/*.png` (transparent background), extracted from the brand asset guide:
  - Full-body poses: `pose_base`, `bienvenidos`, `aprobado`, `delicioso`.
  - Half-body gestures: `cocinando`, `degustacion`, `preparacion`, `listo_servir`.
  - Web/menu icons: `icon_chef`, `icon_batidor`, `icon_espatula`, `icon_cubiertos`, `icon_gorro`, `icon_cafe`, `icon_pedir`, `icon_campana`.
- **Empty states**: use `EmptyState` from `src/components/ui/EmptyState.tsx` (styles in `index.css` as `.app-empty-state*`) instead of ad-hoc empty markup.

## UI/UX Review Skills (vercel-labs)

Este repo tiene skills del laboratorio de Vercel disponibles. Usalas al crear o
retocar UI: la estética actual es funcional pero mejorable, así que el review de
diseño es parte del trabajo, no un extra.

- **`web-design-guidelines`** — audita UI contra las _Web Interface Guidelines_
  (accesibilidad, foco visible, formularios, tipografía, estados vacíos,
  animación, `Intl` para fechas/números, dark mode, anti-patterns). Baja las
  reglas frescas de `vercel-labs/web-interface-guidelines` y devuelve hallazgos
  en formato `archivo:línea`. **Invocarla al construir o revisar cualquier
  pantalla.**
- `vercel-react-best-practices` — patrones de composición/performance de React.
- `vercel-composition-patterns`, `vercel-react-view-transitions`,
  `vercel-optimize`, `vercel-react-native-skills` — disponibles si hacen falta.
- `deploy-to-vercel` / `vercel-cli-with-tokens` — despliegue y CLI.
- `writing-guidelines` — prosa y documentación. `find-skills` — descubrir más.

El resultado del review **no** reemplaza las convenciones de este archivo: los
colores siguen saliendo de los tokens semánticos de `src/index.css`, los vacíos
de `EmptyState` y el estado de datos del patrón `requestKey` + `reloadToken`.

## Directory Structure

- `src/features/<feature>/`: Feature-driven code containing components, services (`*.service.ts`), and feature-specific types.
- `src/components/ui/`: Shared UI primitives (`ConfirmDialog`, `EmptyState`).
- `public/mascot/`: Brand mascot poses, gestures and icons.
- `src/types/database.ts`: Auto-generated Supabase DB types.
- `src/types/domain.ts`: Custom domain definitions.
- `src/lib/`: Shared utilities (`supabase.ts`, `errors.ts`, `formatters.ts`, `theme.ts`).
- `supabase/migrations/`: SQL migrations executed sequentially.
- `supabase/functions/`: Deno Edge Functions.
