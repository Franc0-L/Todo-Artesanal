-- Todo Artesanal v2 — Migración inicial: esquema base
-- Generado según prompt.md (contrato de dominio) y estado-fases-1-4.md
-- (Fases 1-4).
--
-- Alcance de este archivo: SOLO estructura base.
-- NO incluye: funciones, triggers, RLS, datos iniciales.
--
-- Ajustes aplicados en Fase 4:
--   - clients.allows_half_portion (bug del schema original, viene de
--     prompt.md §9 "posibilidad de media vianda").
--   - categoría y clima permanecen en dishes, no en dish_versions.
--
-- gen_random_uuid() es nativo desde PostgreSQL 13 (major_version = 17
-- en supabase/config.toml), no se requiere ninguna extensión para UUIDs.
-- El EXCLUDE con daterange tampoco requiere btree_gist: al combinar un
-- único operando de tipo rango con &&, el soporte GiST nativo alcanza.

-- =========================================================
-- CLIENTS
-- =========================================================
-- clients = configuración actual del cliente (Fase 1/2).
-- El token de acceso vive en client_tokens, no acá (ver más abajo).
-- allows_half_portion: habilita la modalidad media_vianda por cliente.
-- Default false: la posibilidad se habilita explícitamente, no viene
-- activa por defecto. calculate_order_price valida este flag cuando
-- modality = 'media_vianda'.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  special_care text,
  notes text,
  active boolean not null default true,
  allows_half_portion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- CATÁLOGO: PLATOS (dishes / dish_versions)
-- =========================================================
-- dishes = identidad lógica del plato.
--   - category y climate son atributos de clasificación/consulta del
--     plato mismo, NO de una versión puntual (decisión de Fase 4:
--     "Categoría y clima pertenecen al plato, no a su versión").
--   - active es estado actual, tampoco versionado — coherente con
--     clients.active y con la preservación histórica de prompt.md §21
--     (desactivar en vez de borrar).
-- dish_versions = snapshot inmutable de lo que sí cambia con cada
-- edición real del plato: nombre y precio base. Cada edición crea una
-- fila nueva; una versión histórica nunca se sobrescribe.
-- version_number da orden determinista de "versión actual" (created_at
-- puede colisionar), permite referenciar versiones en UI/logs y evita
-- duplicados por plato.

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  category text,
  climate text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- "cualquiera" no es un clima: ausencia de preferencia se modela
  -- como NULL, no como un valor más del enum.
  constraint dishes_climate_check
    check (climate is null or climate in ('frio', 'templado', 'calor'))
);

create table public.dish_versions (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes(id),
  version_number integer not null,
  name text not null,
  price numeric(10,2) not null,
  created_at timestamptz not null default now(),

  constraint dish_versions_price_nonnegative
    check (price >= 0),

  constraint dish_versions_version_positive
    check (version_number > 0),

  constraint dish_versions_unique_version
    unique (dish_id, version_number)
);

create index dish_versions_dish_id_idx
  on public.dish_versions (dish_id);

-- =========================================================
-- CATÁLOGO: MENÚS (menus / menu_versions / menu_version_items)
-- =========================================================
-- menus = identidad lógica; "active" es estado actual, no versionado
-- (mismo criterio que dishes.active).
-- menu_versions = snapshot inmutable (nombre, precio base). Un menú no
-- tiene clima propio: solo los platos que lo componen lo tienen.
-- version_number, igual que en dish_versions, da orden determinista y
-- evita duplicados por menú.
-- menu_version_items = composición de esa versión: exactamente 1
-- "main" + 0..N "side" (el mínimo de 1 "main" queda para capas de
-- dominio/función; acá solo se garantiza el máximo de 1 vía índice
-- parcial). Cada item referencia una dish_version concreta e
-- inmutable, no el plato lógico, para no romper el significado
-- histórico si el plato se edita después. unique(menu_version_id,
-- dish_version_id) impide repetir el mismo plato dentro de un menú.

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_versions (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id),
  version_number integer not null,
  name text not null,
  price numeric(10,2) not null,
  created_at timestamptz not null default now(),

  constraint menu_versions_price_nonnegative
    check (price >= 0),

  constraint menu_versions_version_positive
    check (version_number > 0),

  constraint menu_versions_unique_version
    unique (menu_id, version_number)
);

create index menu_versions_menu_id_idx
  on public.menu_versions (menu_id);

create table public.menu_version_items (
  id uuid primary key default gen_random_uuid(),
  menu_version_id uuid not null references public.menu_versions(id) on delete cascade,
  dish_version_id uuid not null references public.dish_versions(id),
  role text not null,
  created_at timestamptz not null default now(),

  constraint menu_version_items_role_check
    check (role in ('main', 'side')),

  constraint menu_version_items_unique_dish
    unique (menu_version_id, dish_version_id)
);

create index menu_version_items_menu_version_id_idx
  on public.menu_version_items (menu_version_id);

-- A lo sumo un "main" por versión de menú.
create unique index menu_version_items_one_main_idx
  on public.menu_version_items (menu_version_id)
  where role = 'main';

-- =========================================================
-- SEMANAS (weeks / week_days / week_day_options)
-- =========================================================
-- weeks.status = draft | active | closed. Máximo una semana "active"
-- a la vez, y los rangos de fechas entre semanas no pueden solaparse.

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint weeks_status_check
    check (status in ('draft', 'active', 'closed')),

  constraint weeks_dates_valid
    check (end_date >= start_date),

  constraint weeks_no_overlap
    exclude using gist (daterange(start_date, end_date, '[]') with &&)
);

-- A lo sumo una semana "active" a la vez.
create unique index weeks_one_active_idx
  on public.weeks (status)
  where status = 'active';

-- week_days = día concreto dentro de una semana; no es entidad
-- independiente del dominio (siempre existe en contexto de una week).
-- day_of_week: 1 = lunes .. 5 = viernes (fines de semana fuera de
-- alcance).

create table public.week_days (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks(id) on delete cascade,
  day_of_week smallint not null,
  date date not null,
  created_at timestamptz not null default now(),

  constraint week_days_day_of_week_check
    check (day_of_week between 1 and 5),

  constraint week_days_day_matches_date
    check (extract(isodow from date) = day_of_week),

  constraint week_days_week_day_of_week_unique
    unique (week_id, day_of_week),

  constraint week_days_week_date_unique
    unique (week_id, date)
);

-- Nota: "week_days(week_id) = índice" (Fase 3) queda satisfecho por
-- week_days_week_day_of_week_unique, ya que week_id es la columna
-- líder de ese índice único; no se crea un índice adicional redundante.

-- week_day_options = opción disponible en un día concreto. Es "dish" o
-- "menu" (XOR), referenciando siempre una versión inmutable, nunca la
-- identidad lógica mutable, para preservar el significado histórico.

create table public.week_day_options (
  id uuid primary key default gen_random_uuid(),
  week_day_id uuid not null references public.week_days(id) on delete cascade,
  option_type text not null,
  dish_version_id uuid references public.dish_versions(id),
  menu_version_id uuid references public.menu_versions(id),
  created_at timestamptz not null default now(),

  constraint week_day_options_type_check
    check (option_type in ('dish', 'menu')),

  constraint week_day_options_source_xor
    check (
      (option_type = 'dish' and dish_version_id is not null and menu_version_id is null)
      or
      (option_type = 'menu' and menu_version_id is not null and dish_version_id is null)
    )
);

-- No listado explícitamente en "índices requeridos" de Fase 3, pero es
-- el patrón de consulta más frecuente del dominio ("opciones de este
-- día"); no introduce ningún concepto de negocio nuevo.
create index week_day_options_week_day_id_idx
  on public.week_day_options (week_day_id);

-- Requeridos para reconstrucción de uso histórico.
create index week_day_options_dish_version_id_idx
  on public.week_day_options (dish_version_id);

create index week_day_options_menu_version_id_idx
  on public.week_day_options (menu_version_id);

-- =========================================================
-- CLIENTES ESPERADOS (week_expected_clients)
-- =========================================================
-- Población esperada de una semana, congelada al activarla.
-- clients.active NO reemplaza esto: la semana pasada sigue
-- reconociendo correctamente a quién se esperaba en su momento.

create table public.week_expected_clients (
  week_id uuid not null references public.weeks(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  created_at timestamptz not null default now(),

  constraint week_expected_clients_pkey
    primary key (week_id, client_id)
);

create index week_expected_clients_client_id_idx
  on public.week_expected_clients (client_id);

-- =========================================================
-- PRECIOS ESPECIALES DEL CLIENTE
-- =========================================================
-- client_prices: precio especial general/opcional del cliente, una
-- fila por modalidad (no columnas separadas). media_vianda no tiene
-- precio especial propio: se calcula como 50% del precio normal
-- aplicable, por eso no es un valor válido acá.
-- client_product_prices: precio especial por plato puntual (solo
-- platos, no menús compuestos).

create table public.client_prices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  modality text not null,
  price numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint client_prices_modality_check
    check (modality in ('general', 'opcional')),

  constraint client_prices_price_nonnegative
    check (price >= 0),

  constraint client_prices_client_modality_unique
    unique (client_id, modality)
);

create table public.client_product_prices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  price numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint client_product_prices_price_nonnegative
    check (price >= 0),

  constraint client_product_prices_client_dish_unique
    unique (client_id, dish_id)
);

-- =========================================================
-- TOKENS DE ACCESO (client_tokens)
-- =========================================================
-- El token nunca se almacena en texto plano: solo su hash.
-- Como mucho un token vigente (invalidated_at is null) por cliente;
-- los anteriores quedan como historial, nunca se reutilizan.
-- invalidated_at, cuando existe, nunca es anterior a created_at.

create table public.client_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  invalidated_at timestamptz,

  constraint client_tokens_token_hash_unique
    unique (token_hash),

  constraint client_tokens_invalidated_after_created
    check (invalidated_at is null or invalidated_at >= created_at)
);

create index client_tokens_client_id_idx
  on public.client_tokens (client_id);

create unique index client_tokens_one_valid_per_client_idx
  on public.client_tokens (client_id)
  where invalidated_at is null;

-- =========================================================
-- PEDIDOS (orders)
-- =========================================================
-- Un pedido = cliente + opción de día + modalidad + cantidad + precio
-- aplicado (congelado históricamente, independiente de configuración
-- posterior). La modalidad es propiedad del PEDIDO, no de la opción.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  week_day_option_id uuid not null references public.week_day_options(id),
  modality text not null,
  quantity integer not null default 1,
  applied_price numeric(10,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_modality_check
    check (modality in ('general', 'opcional', 'media_vianda')),

  constraint orders_quantity_positive
    check (quantity > 0),

  constraint orders_applied_price_nonnegative
    check (applied_price >= 0),

  constraint orders_client_option_modality_unique
    unique (client_id, week_day_option_id, modality)
);

create index orders_client_id_idx
  on public.orders (client_id);

create index orders_week_day_option_id_idx
  on public.orders (week_day_option_id);

-- =========================================================
-- CANCELACIONES (cancellations)
-- =========================================================
-- Una cancelación = cliente + día completo (no por opción puntual).
-- Cuenta como respuesta para el cálculo de "sin responder".
-- (La regla "pedido + cancelación no coexisten" se implementa en
-- 02_triggers.sql — requiere trigger, no un CHECK de una sola tabla.)

create table public.cancellations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  week_day_id uuid not null references public.week_days(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cancellations_client_day_unique
    unique (client_id, week_day_id)
);

create index cancellations_client_id_idx
  on public.cancellations (client_id);

create index cancellations_week_day_id_idx
  on public.cancellations (week_day_id);