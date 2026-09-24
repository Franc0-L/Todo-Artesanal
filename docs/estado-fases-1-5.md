# Todo Artesanal v2 — Estado de Fases 1–5 (completa)

## Propósito

Consolidado de decisiones aprobadas para continuar el proyecto desde un chat nuevo, sin repetir el análisis previo.

---

# Fase 1 — Reglas de negocio e invariantes

## Dominio general

- `semana = oferta común para todos los clientes`
- `semana ≠ cliente`
- `semana.status = draft | active | closed`
- `semana.closed = históricamente protegida`
- `oferta semanal = configuración de la semana`
- `opción de oferta = unidad seleccionable dentro de un día concreto`
- `opción de oferta puede ser = menú compuesto | plato individual | futura unidad`
- `menú = un plato principal + 0..N guarniciones`
- `media_vianda = modalidad de pedido, nunca categoría ni tipo de plato`
- `modalidad = general | opcional | media_vianda`

## Pedidos

- `pedido = cliente + semana + día + opción de oferta + modalidad + cantidad + precio aplicado`
- `quantity = cantidad de unidades de la modalidad/opción`
- `applied_price = precio unitario histórico aplicado`
- `monto del pedido = quantity × applied_price`
- `pedido histórico = no se reinterpreta mediante configuración actual`

## Precios

- `precio base = pertenece a versión inmutable del plato o menú`
- `precio especial del cliente = configuración actual del cliente`
- `precio aplicado = queda congelado en el pedido`
- `precio histórico ≠ precio actual`
- `precedencia precio normal = específico por plato > general del cliente > precio base`
- `media_vianda = 50% del precio normal aplicable`
- `media_vianda no tiene precio especial propio`
- `client_prices = general + opcional`
- `client_product_prices = solo platos`

## Clientes

- `clients.active = estado actual`
- `cliente inactivo = no elimina ni invalida historial`
- `cuidado especial = configuración actual del cliente`
- `observaciones del cliente = configuración general`
- `order.notes = observación específica del pedido`

## Catálogo

- `plato.categoría = atributo del plato`
- `plato.clima = atributo del plato`
- `versión de plato/menú = inmutable`
- `nueva versión = cada edición`
- `semana histórica = referencia a versión inmutable, no snapshot completo`

## Historial

- `hechos históricos = conservan el contexto necesario`
- `pedido histórico = conserva precio aplicado`
- `cancelación histórica = conserva contexto necesario`
- `sin responder = se determina respecto de la semana correspondiente`
- `cancelación = respuesta del cliente`
- `cancelación = afecta el día completo`
- `una cancelación = por cliente + día`
- `pedido y cancelación = no coexisten para el mismo cliente + día`

## Clientes esperados

- `week_expected_clients = población esperada para una semana`
- `week_expected_clients = se congela cuando la semana pasa a active`
- `sin responder = esperado sin pedido y sin cancelación`
- `cliente que canceló = respondió`

## Tokens

- `acceso cliente = mediante token`
- `token almacenado = hash, nunca valor completo`
- `token anterior al rotar = inmediatamente inválido`
- `historial de tokens = se conserva`
- `token vigente máximo = uno por cliente`

## Seguridad

- `seguridad = backend/RLS + restricciones DB`
- `cliente = solo puede acceder/modificar sus propios datos permitidos`
- `frontend = no es frontera de seguridad`

## Invariantes

Las 11 invariantes originales de §36 permanecen vigentes.

Extensión propuesta y aprobada de las invariantes de §36:

- `invariante 12 = las cancelaciones conservan su contexto histórico`
- `invariante 13 = sin responder se determina respecto de la semana correspondiente`
- `invariante 14 = la oferta semanal es común; las diferencias individuales pertenecen a configuración/pedido`
- `invariante 15 = los hechos históricos no se reinterpretan mediante datos actuales`

---

# Fase 2 — Modelo conceptual

## Semana y oferta

- `semana + oferta = una sola entidad conceptual`
- `semana = período operativo + oferta`
- `semana → día → opciones de oferta`
- `opción de oferta = existe en contexto de (semana, día)`

## Días

- `día de semana = valor asociado al día dentro de una semana`
- `día de semana = no es entidad independiente`
- `day_of_week = 1..5`
- `1 = lunes`
- `5 = viernes`
- `fines de semana = no forman parte del dominio actual`

## Opciones de oferta

- `opción de oferta ≠ menú`
- `opción de oferta = abstracción seleccionable`
- `opción de oferta actual = plato o menú`
- `futura unidad de oferta = puede incorporarse mediante evolución explícita`

## Versionado

- `estrategia histórica = versiones inmutables`
- `cada edición = nueva versión`
- `versión anterior = nunca se modifica`
- `semana histórica = apunta a versión concreta`
- `precio base = forma parte de la versión`
- `cambio de precio base = nueva versión`

## Cliente

- `cliente = configuración actual`
- `cliente = datos + contacto + dirección + cuidado especial + observaciones + estado + precios + acceso`

## Pedido

- `pedido = cliente + opción de día + modalidad + cantidad + precio aplicado`
- `pedido = una única selección por cliente + opción + modalidad`
- `quantity = unidades`
- `applied_price = unitario`
- `pedido histórico = independiente de cambios posteriores`

## Cancelación

- `cancelación = hecho propio`
- `cancelación = cliente + día`
- `cancelación = día completo`
- `cancelación = respuesta`

## Token

- `token = identidad de acceso del cliente`
- `token = hash`
- `token rotado = invalidación estricta`
- `tokens anteriores = historial`

---

# Fase 3 — Modelo PostgreSQL

## Entidades principales

- `clients = clientes actuales`
- `dishes = identidad lógica de platos`
- `dish_versions = versiones inmutables de platos`
- `menus = identidad lógica de menús`
- `menu_versions = versiones inmutables de menús`
- `menu_version_items = composición de una versión de menú`
- `weeks = período + estado`
- `week_days = día concreto dentro de una semana`
- `week_day_options = opción disponible para un día`
- `week_expected_clients = clientes esperados para la semana`
- `client_prices = precios generales especiales`
- `client_product_prices = precios especiales por plato`
- `client_tokens = historial de tokens`
- `orders = pedidos`
- `cancellations = cancelaciones`

## Versiones

- `dish_versions.price = precio base`
- `menu_versions.price = precio base`
- `dish_versions = inmutables`
- `menu_versions = inmutables`
- `cada edición = nueva versión`
- `version histórica = nunca se sobrescribe`

## Menús

- `menu_version = exactamente 1 main + 0..N side`
- `main = plato principal`
- `side = guarnición`

## Opciones de día

- `week_day_options = pertenece a un week_day`
- `offer_option_type = flexible mediante text + CHECK`
- `tipo actual de opción = dish | menu`
- `opción = exactamente una fuente actual`
- `dish_version_id XOR menu_version_id`

## Clientes esperados

- `week_expected_clients PK = (week_id, client_id)`
- `población esperada = congelada al activar semana`
- `clients.active = no reemplaza week_expected_clients`

## Precios especiales

- `client_prices = general + opcional`
- `client_prices.media_vianda = no existe`
- `client_product_prices = solo platos`
- `precedencia = precio específico por plato > precio general > precio base`
- `media_vianda = precio normal aplicable / 2`

## Pedidos

- `orders.applied_price = numeric(10,2)`
- `orders.applied_price = unitario`
- `orders.quantity = entero positivo`
- `pedido.total = quantity × applied_price`
- `UNIQUE = (client_id, week_day_option_id, modality)`
- `order.notes = nota específica del pedido`

## Cancelaciones

- `UNIQUE = (client_id, week_day_id)`
- `cancelación = día completo`
- `cancelación + pedido del mismo cliente/día = no permitido`
- `cancelación = cuenta como respuesta`

## Semanas

- `week.status = draft | active | closed`
- `active = máximo una semana`
- `weeks con rangos solapados = no permitidos`
- `week_day.day_of_week = 1..5`

## Tokens

- `token_hash = único`
- `token = nunca almacenado en texto plano`
- `invalidated_at = NULL mientras vigente`
- `máximo un token vigente por cliente`
- `token histórico = permanece registrado`

## Índices requeridos

- `week_day_options(dish_version_id) = requerido para uso histórico`
- `week_day_options(menu_version_id) = requerido para uso histórico`
- `week_days(week_id) = índice`
- `week_expected_clients(client_id) = índice`
- `orders(client_id) = índice`
- `orders(week_day_option_id) = índice`
- `cancellations(client_id) = índice`
- `cancellations(week_day_id) = índice`
- `client_tokens(client_id) = índice`
- `dish_versions(dish_id) = índice`
- `menu_versions(menu_id) = índice`
- `menu_version_items(menu_version_id) = índice`

---

# Fase 4 — decisiones cerradas

## Tipos y CHECKs

- `weeks.status = text + CHECK (draft | active | closed)`
- `week_day_options.option_type = text + CHECK (dish | menu)`
- `menu_version_items.role = text + CHECK (main | side)`
- `orders.modality = text + CHECK (general | opcional | media_vianda)`
- `client_prices.modality = text + CHECK (general | opcional)`
- `dishes.climate = text nullable, CHECK (frio | templado | calor)`
- `dishes.category = text libre, sin CHECK (taxonomía no cerrada)`
- `climate: NULL = ausencia de preferencia, no "cualquiera"`

## Catálogo

- `categoría y clima = atributos del plato (dishes), no de su versión`
- `dish_versions = nombre, price, version_number`
- `menu_versions = nombre, price, version_number`
- `dishes.active / menus.active = boolean not null default true, estado actual, no versionado`
- `dish_versions.version_number = obligatorio, CHECK > 0`
- `menu_versions.version_number = obligatorio, CHECK > 0`
- `dish_versions UNIQUE (dish_id, version_number)`
- `menu_versions UNIQUE (menu_id, version_number)`

## Menú items

- `menu_version_items: UNIQUE (menu_version_id, dish_version_id)`
- `menu_version_items: partial unique WHERE role='main'` (máximo 1 main)
- `menu_version_items: minimum 1 main = constraint trigger diferible`
  (implementado en `02_triggers.sql`)

## Semanas y días

- `weeks.no_overlap = EXCLUDE gist daterange [start_date, end_date]`
- `weeks.one_active = partial unique index WHERE status='active'`
- `week_days.date = materializado`
- `week_days.date = CHECK coherencia con day_of_week (extract isodow)`
- `week_days UNIQUE (week_id, day_of_week)`
- `week_days UNIQUE (week_id, date)`

## Tokens

- `client_tokens.invalidated_at >= created_at = CHECK`

## Pedidos y cancelaciones

- `orders.quantity = integer not null default 1, CHECK > 0`
- `orders.applied_price = numeric(10,2) CHECK >= 0`
- `orders.notes = nullable`
- `cancellations: UNIQUE (client_id, week_day_id)`

## Ajuste aplicado a schema-v1.sql

- `clients.allows_half_portion = boolean not null default false`
  - Habilita la modalidad media_vianda por cliente.
  - Default false: la posibilidad se habilita por cliente.
  - `calculate_order_price` valida este flag cuando modality = media_vianda.

## Semántica de orders

- `orders INSERT: applied_price = calculado desde calculate_order_price`
  (se ignora cualquier valor que mande el cliente)
- `orders UPDATE: solo quantity y notes son editables`
- `orders UPDATE: applied_price inmutable post-creación`
- `orders UPDATE: client_id / week_day_option_id / modality no editables`
  - Para cambiar esos campos: DELETE + INSERT
- `orders DELETE: permitido mientras la semana no esté closed`

## week_day_options — congelamiento post-pedido

- `week_day_options UPDATE: rechazar si la opción ya tiene pedidos asociados`
- `week_day_options DELETE: rechazar si la opción ya tiene pedidos asociados`
- Fundamento: cierra gap de invariante #15 dentro de semanas active.
  Si un pedido ya se hizo contra una opción, esa opción queda congelada.
  Sin pedidos, sigue editable/borrable.

## Seguridad

- `private.admin_users = creada en 03_rls.sql`
  (la tabla, no el contenido)
- `private.is_admin() = security definer, lee auth.uid() contra admin_users`
- `private.current_client_id() = security definer, lee auth.jwt() ->> 'client_id'`
  - Devuelve NULL si el claim no existe o no es UUID válido (defensiva).
- `public.is_user_admin(p_user_id) = security definer, RPC público para que
  la Edge Function verifique admins sin acceder al schema private`
- `RLS habilitado en las 15 tablas públicas + admin_users`
- `policies admin = FOR ALL en todas las tablas, con is_admin()`
- `policies cliente = según checklist (ver abajo)`
- `cliente NO accede a: client_tokens, week_expected_clients, dishes, menus`
- `service_role grants defensivos = usage schema + all tables + all functions
  + usage private + select admin_users`
- `primer admin = INSERT manual en 04_admin_setup.sql`

## Checklist de policies de cliente

Cliente SÍ accede:

- `clients → SELECT propio`
- `weeks → SELECT active`
- `week_days → SELECT de semanas active`
- `week_day_options → SELECT de semanas active`
- `dish_versions → SELECT usadas en oferta active`
- `menu_versions → SELECT usadas en oferta active`
- `menu_version_items → SELECT de versiones usadas en oferta active`
- `orders → SELECT/INSERT/UPDATE propio (sin DELETE)`
- `cancellations → SELECT/INSERT/UPDATE propio (sin DELETE)`
- `client_prices → SELECT propio`
- `client_product_prices → SELECT propio`

Cliente NO accede (sin policy):

- `client_tokens`
- `week_expected_clients`
- `dishes`
- `menus`

Nota: cliente no puede filtrar por `dishes.category` ni `dishes.climate`.
Si en el futuro se necesitan filtros, agregar policy sobre `dishes`.

## Ciclo de vida de la semana

- `activate_week(week_id) = draft → active`
  - Valida admin, semana draft, no otra active, 5 días,
    cada día con al menos una opción, cada menu_version con exactamente
    1 main.
  - Congela `week_expected_clients` con `clients.active = true`.
  - Usa variable de sesión `todo_artesanal.allow_week_transition`
    (set_config con is_local = true) para autorizar el UPDATE.
- `close_week(week_id) = active → closed` (terminal)
- `trigger BEFORE UPDATE ON weeks` bloquea cambios directos de status.

## Inmutabilidad

- `dish_versions: rechazar UPDATE/DELETE` (trigger)
- `menu_versions: rechazar UPDATE/DELETE` (trigger)
- `weeks closed: rechazar INSERT/UPDATE/DELETE sobre week_days,
  week_day_options, orders, cancellations de esa semana`

---

# Fase 5 — Implementación backend (completa)

## Fase 5A — Migraciones aplicadas

- Proyecto Supabase: `Todo-Artesanal` (linkeado).
- 9 migraciones aplicadas (en orden):
  - `20260923000001_schema.sql`
  - `20260923000002_functions.sql`
  - `20260923000003_triggers.sql`
  - `20260923000004_rls.sql`
  - `20260923000005_admin_setup.sql`
  - `20260924000001_menu_rpc.sql`
  - `20260924000002_week_rpc.sql`
  - `20260924000003_edge_function_grants.sql`
  - `20260924000004_admin_check_rpc.sql`
- 15 tablas en `public`.
- Funciones privadas en `private` (`is_admin`, `current_client_id`).
- Funciones públicas de dominio:
  - `calculate_order_price`, `activate_week`, `close_week`
  - `create_menu`, `create_menu_version`
  - `create_week`, `update_week`
  - `is_user_admin` (RPC para Edge Function)
- Edge Function deployada: `rotate-client-token`.
- 1 admin creado en `private.admin_users`.

## Fase 5B — Tipos y helpers

- `src/types/database.ts` — generado con `npx supabase gen types typescript --linked`.
- `src/types/domain.ts` — tipos transversales:
  - `Modality = 'general' | 'opcional' | 'media_vianda'`
  - `ClientPriceModality = 'general' | 'opcional'`
  - `WeekStatus = 'draft' | 'active' | 'closed'`
  - `MenuItemRole = 'main' | 'side'`
  - `OptionType = 'dish' | 'menu'`
  - `Climate = 'frio' | 'templado' | 'calor'`
  - `DayOfWeek = 1 | 2 | 3 | 4 | 5`
- `src/lib/supabase.ts` — cliente Supabase inicializado.
- `src/lib/errors.ts` — `AppError` + `isAppError`.
- `src/lib/error-handler.ts` — `runSupabase`, `runSupabaseFull`, `runSupabaseOrThrow`, `toAppError`.
- `src/lib/formatters.ts` — `formatCurrency`, `formatDate`, `formatDateRange`.
- `src/vite-env.d.ts` — declaración de `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Fase 5C — Servicios (completa)

### Patrón establecido

- Manejo de errores: `throw AppError`, nunca `return { data, error }`.
- Helpers de acceso a Supabase:
  - `runSupabase<T>` → `T | null`
  - `runSupabaseFull<T>` → `{ data, count, status }`
  - `runSupabaseOrThrow<T>` → `T` (falla con NOT_FOUND si null)
  - Todos aceptan `() => PromiseLike<SupabaseResult<T>>`.
- Genéricos explícitos en cada llamada. La inferencia no funciona con `PostgrestBuilder`.
- Validación manual de inputs con `AppError` (sin Zod).
- `validateUuid` con regex antes de usar IDs.
- `escapeIlikePattern` antes de `.or(...ilike...)`.
- Mappers snake_case (DB) → camelCase (app).
- Retorno tipos de dominio, no `Tables<'...'>`.
- Uso de `Tables<>`, `TablesInsert<>`, `TablesUpdate<>` de `database.ts`.
- `deleteX` documenta advertencias de FK.
- RPCs que devuelven `void` usan `runSupabase` (no `runSupabaseOrThrow`).

### Servicios implementados

**clientes/**

- `clients.service.ts`: listClients, getClient, createClient, updateClient, setClientActive, deleteClient.
- `client-prices.service.ts`: getClientPrices, setClientPrice, removeClientPrice, listClientProductPrices, setClientProductPrice, removeClientProductPrice.
- `client-tokens.service.ts`: getActiveTokenStatus, rotateClientToken (llama Edge Function rotate-client-token).

**platos/**

- `dishes.service.ts`: listDishes, getDish, createDish (identidad + versión 1 con rollback manual), updateDish, setDishActive, deleteDish.
- `dish-versions.service.ts`: listDishVersions, getDishVersion, createDishVersion.
- `dish-usage.service.ts`: getDishUsage, getRecentDishUsage, getDishSuggestions.

**menus/**

- `menus.service.ts`: listMenus, getMenu, createMenu (RPC create_menu), setMenuActive, deleteMenu.
- `menu-versions.service.ts`: listMenuVersions, getMenuVersion, getLatestMenuVersion, createMenuVersion (RPC create_menu_version).

**semanas/**

- `weeks.service.ts`: listWeeks, getWeek, getActiveWeek, createWeek (RPC create_week), updateWeek (RPC update_week), activateWeek (RPC activate_week), closeWeek (RPC close_week).
- `week-days.service.ts`: listWeekDays, getWeekDay.
- `week-offer.service.ts`: listDayOptions, getWeekOffer, addDayOption, updateDayOption, removeDayOption.
- `week-expected-clients.service.ts`: getExpectedClients, getExpectedClientCount.

**pedidos/**

- `orders.service.ts`: listOrders, getOrder, createOrder, updateOrder, deleteOrder, getOrderTotals.

**cancelaciones/**

- `cancellations.service.ts`: listCancellations, getCancellation, createCancellation, deleteCancellation.

**historial/**

- `history.service.ts`: listHistoricalWeeks, getClientHistory, getUnansweredClients.

### Edge Functions implementadas

**rotate-client-token/**

- Recibe `{ clientId: uuid }` por POST.
- Requiere JWT de admin en `Authorization: Bearer <jwt>`.
- Verifica admin vía RPC público `is_user_admin`.
- Invalida el token vigente del cliente (`invalidated_at = now()`).
- Genera token random de 32 bytes (base64url).
- Persiste SHA-256 del token en `client_tokens.token_hash`.
- Devuelve `{ token: plaintext, clientId }`.
- El plaintext se devuelve una única vez, nunca se persiste.
- Variables de entorno inyectadas por Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Usa `service_role` internamente para operar sobre `client_tokens` (que no tiene policy de cliente).

### TODOs anotados en el código

- `dishes.service.ts` listDishes: búsqueda por `.in()` puede romper con catálogos grandes. Migrar a vista o RPC.
- `dish-versions.service.ts` createDishVersion: race condition teórica entre MAX+1 e INSERT. UNIQUE evita corrupción.
- `dish-usage.service.ts`: uso actual = solo platos ofrecidos directamente. No cuenta dentro de menús.
- `dish-usage.service.ts`: agregaciones en cliente. Migrar a vista o RPC si crece el volumen.
- `createDish` sigue usando rollback manual. Convive con el problema conceptual de no-transacción, aunque no lo expone porque `dishes` no tiene trigger inmutable. TODO: migrar a RPC cuando toque refactor.
- `menus.service.ts` listMenus: búsqueda por `.in()` + agregación de itemCount en cliente. Migrar a vista si crece.
- `weeks.service.ts` updateWeek: borra week_day_options existentes (cascade). Documentado; evaluar flag `confirmDeleteOptions` en el futuro.
- `history.service.ts`: agregados (totalAmount, unanswered, etc.) calculados en cliente. Migrar a vista o RPC si el volumen crece.
- `orders.service.ts` getOrderTotals: SUM en cliente. Migrar a vista o RPC si crece.

---

# Pendientes — Fase 6 en adelante

## Reportes

- Vistas o funciones de reporte de montos consolidados.

## Features frontend

- UI de admin (`/admin`).
- UI de cliente (`/menu/:token`).
- Toda la capa de React.

## Tests

- Tests de invariantes contra la DB real.

## Documentación

- `docs/arquitectura.md` completo.
- `docs/servicios.md` completo.
- `docs/dominio.md`, `docs/modelo-datos.md`, `docs/flujos.md`.
- README del proyecto.

---

# Archivos SQL generados

## 20260923000001_schema.sql

- DDL base completo. Estructura base (tablas, constraints, índices).
- Incluye `clients.allows_half_portion`.
- NO incluye funciones, triggers, RLS, datos iniciales.

## 20260923000002_functions.sql

- `calculate_order_price(client_id, week_day_option_id, modality)`
  - precedencia: dish_specific > client_prices[modalidad] > base_price
  - media_vianda: precio normal (rama general) / 2
  - no aplica client_product_prices a menús
  - security definer
- `activate_week(week_id)` — draft → active
  - security definer + chequeo admin
  - congela week_expected_clients
  - usa variable `todo_artesanal.allow_week_transition`
- `close_week(week_id)` — active → closed
  - security definer + chequeo admin

## 20260923000003_triggers.sql

- Inmutabilidad dish_versions / menu_versions (UPDATE/DELETE)
- `menu_version_items`: constraint trigger DEFERRABLE INITIALLY DEFERRED
  que garantiza ≥1 main al COMMIT
- `weeks.status`: trigger que bloquea cambios directos
  (usa `todo_artesanal.allow_week_transition`)
- `weeks closed`: protección de week_days, week_day_options, orders,
  cancellations
- `orders`: validación + congelamiento de applied_price + inmutabilidad
  de campos clave
- `week_day_options`: congelamiento post-pedido
- `orders ↔ cancellations`: no coexistencia (cliente + día)

## 20260923000004_rls.sql

- `create schema if not exists private`
- `private.admin_users` (tabla)
- `private.is_admin()` (security definer)
- `private.current_client_id()` (security definer, defensiva)
- RLS habilitado en las 15 tablas públicas + admin_users
- Policies de admin (FOR ALL) en todas las tablas
- Policies de cliente según checklist
- Grants de tablas y funciones
- Grants defensivos para service_role

## 20260923000005_admin_setup.sql

- INSERT del primer administrador (comentado, placeholder UUID).
- Comentarios con instrucciones para agregar futuros admins.

## 20260924000001_menu_rpc.sql

- `create_menu(p_name, p_price, p_items jsonb, p_active bool) → uuid`
  - security definer + is_admin()
  - valida: nombre no vacío, precio ≥ 0, items array no vacío, sin
    dish_version_id repetidos, exactamente 1 main, dish_versions existen
  - inserta menus + menu_versions (v1) + menu_version_items en una
    transacción
- `create_menu_version(p_menu_id, p_name, p_price, p_items jsonb) → uuid`
  - mismas validaciones
  - calcula MAX(version_number) + 1
  - inserta en una transacción

## 20260924000002_week_rpc.sql

- `create_week(p_start_date date, p_end_date date) → uuid`
  - security definer + is_admin()
  - valida: lunes a viernes, 5 días exactos, fechas válidas
  - inserta weeks (draft) + 5 week_days en una transacción
  - el EXCLUDE gist weeks_no_overlap impide solapamiento (23P01)
- `update_week(p_week_id, p_start_date, p_end_date)`
  - solo permite modificar semanas en draft
  - borra week_days actuales (cascade a week_day_options) y recrea
  - ADVERTENCIA documentada: si había opciones cargadas, se pierden

## 20260924000003_edge_function_grants.sql

- `grant usage on schema private to service_role`
- `grant select on table private.admin_users to service_role`
- Necesario porque la Edge Function necesita verificar admins
  (aunque terminó usando el RPC público `is_user_admin`).

## 20260924000004_admin_check_rpc.sql

- `is_user_admin(p_user_id uuid) → boolean`
  - security definer + set search_path = public, private
  - consulta private.admin_users
  - revocado de public y authenticated
  - grant execute a service_role
  - necesario para que la Edge Function verifique admins sin acceder
    al schema private vía PostgREST (que solo expone public)