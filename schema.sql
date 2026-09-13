create extension if not exists pgcrypto;

-- ============================================================
-- ESQUEMA CANÓNICO DE TODO ARTESANAL
-- ============================================================
-- Este archivo representa el estado actual de la base de datos.
-- Para cambios sobre una base ya existente, usar migraciones de
-- supabase/migrations/ y NO ejecutar este archivo sobre producción.

-- ============================================================
-- SEGURIDAD
-- ============================================================
create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now()
);

alter table private.admin_users enable row level security;

create or replace function private.es_admin()
returns boolean
security definer
set search_path = ''
stable
language sql
as $$
  select exists (
    select 1
    from private.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.es_admin() from public;

-- ============================================================
-- TABLAS
-- ============================================================
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  cuidados_alimentarios text,
  activo boolean not null default true,
  -- Credencial de acceso al menú personal: 128 bits de entropía.
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  precio_general_especial numeric(10,2),
  precio_opcional_especial numeric(10,2),
  creado_en timestamptz not null default now(),
  constraint clientes_precio_general_especial_check check (precio_general_especial is null or precio_general_especial >= 0),
  constraint clientes_precio_opcional_especial_check check (precio_opcional_especial is null or precio_opcional_especial >= 0)
);

create table if not exists semanas (
  id uuid primary key default gen_random_uuid(),
  fecha_inicio date not null unique,
  precio_general numeric(10,2) not null check (precio_general >= 0),
  precio_opcional numeric(10,2) not null check (precio_opcional >= 0),
  activa boolean not null default true
);

create unique index if not exists una_semana_activa
  on semanas (activa)
  where activa = true;

create table if not exists platos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text,
  clima text not null default 'cualquiera'
    check (clima in ('frio', 'templado', 'calor', 'cualquiera')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Evita duplicados accidentales por mayúsculas/espacios.
create unique index if not exists uq_platos_nombre_normalizado
  on platos (lower(trim(nombre)));

create table if not exists dias_menu (
  id uuid primary key default gen_random_uuid(),
  semana_id uuid not null references semanas(id) on delete cascade,
  dia_semana text not null
    check (dia_semana in ('lunes','martes','miercoles','jueves','viernes')),
  fecha date not null,
  plato_general_id uuid not null references platos(id),
  plato_opcional_id uuid not null references platos(id),
  notas_temperatura text,
  unique (semana_id, dia_semana),
  unique (semana_id, fecha),
  check (plato_general_id <> plato_opcional_id)
);

create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  dia_menu_id uuid not null references dias_menu(id) on delete cascade,
  tipo_menu text not null check (tipo_menu in ('general','opcional','no_come')),
  actualizado_en timestamptz not null default now(),
  unique (cliente_id, dia_menu_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_dias_menu_semana_fecha
  on dias_menu (semana_id, fecha);

create index if not exists idx_dias_menu_plato_general
  on dias_menu (plato_general_id);

create index if not exists idx_dias_menu_plato_opcional
  on dias_menu (plato_opcional_id);

create index if not exists idx_pedidos_dia_menu
  on pedidos (dia_menu_id);

create index if not exists idx_pedidos_cliente
  on pedidos (cliente_id);

create index if not exists idx_clientes_activo
  on clientes (activo);

create index if not exists idx_platos_activo_nombre
  on platos (activo, nombre);

-- ============================================================
-- TRIGGERS
-- ============================================================
create or replace function set_actualizado_en()
returns trigger
set search_path = ''
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trg_pedidos_actualizado on pedidos;
create trigger trg_pedidos_actualizado
before update on pedidos
for each row execute function set_actualizado_en();

-- ============================================================
-- VISTAS
-- ============================================================
create or replace view vista_pedidos_semana
with (security_invoker = true) as
select
  p.id as pedido_id,
  c.id as cliente_id,
  c.nombre,
  dm.semana_id,
  dm.id as dia_menu_id,
  dm.dia_semana,
  dm.fecha,
  p.tipo_menu,
  case
    when p.tipo_menu = 'no_come' then 0
    when p.tipo_menu = 'general' then coalesce(c.precio_general_especial, s.precio_general)
    else coalesce(c.precio_opcional_especial, s.precio_opcional)
  end as monto
from pedidos p
join clientes c on c.id = p.cliente_id
join dias_menu dm on dm.id = p.dia_menu_id
join semanas s on s.id = dm.semana_id;

create or replace view vista_uso_platos
with (security_invoker = true) as
select
  p.id,
  p.nombre,
  p.categoria,
  p.clima,
  p.activo,
  greatest(
    (select max(dm.fecha) from dias_menu dm where dm.plato_general_id = p.id),
    (select max(dm.fecha) from dias_menu dm where dm.plato_opcional_id = p.id)
  ) as ultima_vez_usado
from platos p;

-- ============================================================
-- RLS Y PERMISOS
-- ============================================================
alter table clientes enable row level security;
alter table semanas enable row level security;
alter table dias_menu enable row level security;
alter table pedidos enable row level security;
alter table platos enable row level security;

drop policy if exists "admin_full_access_clientes" on clientes;
create policy "admin_full_access_clientes" on clientes
  for all to authenticated
  using ((select private.es_admin()))
  with check ((select private.es_admin()));

drop policy if exists "admin_full_access_semanas" on semanas;
create policy "admin_full_access_semanas" on semanas
  for all to authenticated
  using ((select private.es_admin()))
  with check ((select private.es_admin()));

drop policy if exists "admin_full_access_dias_menu" on dias_menu;
create policy "admin_full_access_dias_menu" on dias_menu
  for all to authenticated
  using ((select private.es_admin()))
  with check ((select private.es_admin()));

drop policy if exists "admin_full_access_pedidos" on pedidos;
create policy "admin_full_access_pedidos" on pedidos
  for all to authenticated
  using ((select private.es_admin()))
  with check ((select private.es_admin()));

drop policy if exists "admin_full_access_platos" on platos;
create policy "admin_full_access_platos" on platos
  for all to authenticated
  using ((select private.es_admin()))
  with check ((select private.es_admin()));

revoke all on clientes, semanas, dias_menu, pedidos, platos from anon;
grant select, insert, update, delete on clientes, semanas, dias_menu, pedidos, platos to authenticated;

revoke all on vista_pedidos_semana from public, anon;
grant select on vista_pedidos_semana to authenticated;

revoke all on vista_uso_platos from public, anon;
grant select on vista_uso_platos to authenticated;

-- ============================================================
-- FUNCIONES DEL CLIENTE
-- ============================================================
create or replace function get_client_menu(p_token text)
returns table (
  cliente_nombre text,
  semana_inicio date,
  dia_menu_id uuid,
  dia_semana text,
  fecha date,
  plato_general text,
  plato_general_clima text,
  plato_opcional text,
  plato_opcional_clima text,
  notas_temperatura text,
  eleccion_actual text
)
security definer
set search_path = ''
language sql
as $$
  select
    c.nombre,
    s.fecha_inicio,
    dm.id,
    dm.dia_semana,
    dm.fecha,
    pg.nombre,
    pg.clima,
    po.nombre,
    po.clima,
    dm.notas_temperatura,
    (
      select p.tipo_menu
      from pedidos p
      where p.cliente_id = c.id
        and p.dia_menu_id = dm.id
    )
  from clientes c
  join semanas s on s.activa = true
  join dias_menu dm on dm.semana_id = s.id
  join platos pg on pg.id = dm.plato_general_id
  join platos po on po.id = dm.plato_opcional_id
  where c.token = p_token
    and c.activo = true
  order by dm.fecha;
$$;

revoke all on function get_client_menu(text) from public;
grant execute on function get_client_menu(text) to anon;

-- ============================================================
-- CREACIÓN DE SEMANA
-- ============================================================
create or replace function crear_semana(
  p_fecha_inicio date,
  p_precio_general numeric,
  p_precio_opcional numeric,
  p_dias jsonb
)
returns uuid
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_semana_id uuid;
  v_dia jsonb;
  v_dia_semana text;
  v_fecha date;
  v_general uuid;
  v_opcional uuid;
  v_indice integer := 0;
begin
  if not (select private.es_admin()) then
    raise exception 'No autorizado';
  end if;

  if p_fecha_inicio is null or extract(isodow from p_fecha_inicio) <> 1 then
    raise exception 'La fecha de inicio debe ser un lunes';
  end if;

  if p_precio_general is null or p_precio_general < 0
     or p_precio_opcional is null or p_precio_opcional < 0 then
    raise exception 'Los precios no pueden ser negativos';
  end if;

  if p_dias is null or jsonb_typeof(p_dias) <> 'array'
     or jsonb_array_length(p_dias) <> 5 then
    raise exception 'La semana debe contener exactamente 5 días';
  end if;

  for v_dia in select * from jsonb_array_elements(p_dias)
  loop
    v_indice := v_indice + 1;
    v_dia_semana := v_dia ->> 'dia_semana';

    begin
      v_fecha := (v_dia ->> 'fecha')::date;
      v_general := (v_dia ->> 'plato_general_id')::uuid;
      v_opcional := (v_dia ->> 'plato_opcional_id')::uuid;
    exception when others then
      raise exception 'Datos inválidos en el día %', v_indice;
    end;

    if v_dia_semana not in ('lunes','martes','miercoles','jueves','viernes') then
      raise exception 'Día de semana inválido: %', v_dia_semana;
    end if;

    if v_fecha <> p_fecha_inicio + (v_indice - 1) then
      raise exception 'Las fechas de la semana no son consecutivas';
    end if;

    if v_general = v_opcional then
      raise exception 'El plato general y opcional no pueden ser iguales el día %', v_indice;
    end if;

    if not exists (
      select 1 from platos where id = v_general and activo = true
    ) or not exists (
      select 1 from platos where id = v_opcional and activo = true
    ) then
      raise exception 'Todos los platos seleccionados deben existir y estar activos';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_dias) dia
    group by dia ->> 'dia_semana'
    having count(*) <> 1
  ) then
    raise exception 'No puede haber días repetidos';
  end if;

  update semanas
  set activa = false
  where activa = true;

  insert into semanas (fecha_inicio, precio_general, precio_opcional, activa)
  values (p_fecha_inicio, p_precio_general, p_precio_opcional, true)
  returning id into v_semana_id;

  for v_dia in select * from jsonb_array_elements(p_dias)
  loop
    insert into dias_menu (
      semana_id,
      dia_semana,
      fecha,
      plato_general_id,
      plato_opcional_id,
      notas_temperatura
    )
    values (
      v_semana_id,
      v_dia ->> 'dia_semana',
      (v_dia ->> 'fecha')::date,
      (v_dia ->> 'plato_general_id')::uuid,
      (v_dia ->> 'plato_opcional_id')::uuid,
      nullif(v_dia ->> 'notas_temperatura', '')
    );
  end loop;

  return v_semana_id;
end;
$$;

revoke all on function crear_semana(date, numeric, numeric, jsonb) from public;
grant execute on function crear_semana(date, numeric, numeric, jsonb) to authenticated;
