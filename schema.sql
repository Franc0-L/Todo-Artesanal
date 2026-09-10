create extension if not exists pgcrypto;

-- ============================================================
-- TABLAS
-- ============================================================

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  cuidados_alimentarios text,
  activo boolean not null default true,
  -- token único que identifica el link personal del cliente (/menu/<token>)
  -- 128 bits de entropía: el enlace es una credencial de acceso del cliente.
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  -- si están en NULL, se usa el precio general de la semana (ver tabla semanas)
  precio_general_especial numeric(10,2),
  precio_opcional_especial numeric(10,2),
  creado_en timestamptz not null default now()
);

create table semanas (
  id uuid primary key default gen_random_uuid(),
  fecha_inicio date not null unique,
  precio_general numeric(10,2) not null,
  precio_opcional numeric(10,2) not null,
  -- solo una semana debería estar activa a la vez; lo hace cumplir el índice de abajo
  activa boolean not null default true
);

create unique index una_semana_activa on semanas (activa) where activa = true;

create table dias_menu (
  id uuid primary key default gen_random_uuid(),
  semana_id uuid not null references semanas(id) on delete cascade,
  dia_semana text not null check (dia_semana in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  fecha date not null,
  plato_general text not null,
  plato_opcional text not null,
  notas_temperatura text,
  unique (semana_id, dia_semana)
);

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  dia_menu_id uuid not null references dias_menu(id) on delete cascade,
  -- 'no_come' cubre tanto "elige no comer ese día" como una cancelación posterior:
  -- el cliente simplemente cambia su elección al mismo valor, no hace falta un estado aparte
  tipo_menu text not null check (tipo_menu in ('general','opcional','no_come')),
  actualizado_en timestamptz not null default now(),
  unique (cliente_id, dia_menu_id)
);

create or replace function set_actualizado_en()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_pedidos_actualizado
before update on pedidos
for each row execute function set_actualizado_en();

-- ============================================================
-- VISTA: pedidos de la semana con el monto ya calculado
-- (precio especial del cliente si existe, si no el precio de la semana)
-- ============================================================

create or replace view vista_pedidos_semana with (security_invoker = true) as
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

-- ============================================================
-- SEGURIDAD (RLS)
-- ============================================================
-- El panel de administración usa un usuario autenticado que figure en
-- private.admin_users. "authenticated" por sí solo no identifica a un administrador:
-- cualquier cuenta creada en Auth tendría ese rol.
-- La pantalla del cliente NO usa autenticación: solo puede pasar por las dos
-- funciones de abajo, que validan el token antes de leer o escribir nada.

create schema if not exists private;
revoke all on schema private from public;

create table private.admin_users (
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

alter table clientes enable row level security;
alter table semanas enable row level security;
alter table dias_menu enable row level security;
alter table pedidos enable row level security;

create policy "admin_full_access_clientes" on clientes for all to authenticated using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "admin_full_access_semanas" on semanas for all to authenticated using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "admin_full_access_dias_menu" on dias_menu for all to authenticated using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "admin_full_access_pedidos" on pedidos for all to authenticated using ((select private.es_admin())) with check ((select private.es_admin()));

revoke all on clientes, semanas, dias_menu, pedidos from anon;
grant select, insert, update, delete on clientes, semanas, dias_menu, pedidos to authenticated;
revoke all on vista_pedidos_semana from public, anon;
grant select on vista_pedidos_semana to authenticated;

-- ============================================================
-- FUNCIONES para la pantalla del cliente (rol anónimo)
-- ============================================================

create or replace function get_client_menu(p_token text)
returns table (
  cliente_nombre text,
  semana_inicio date,
  dia_menu_id uuid,
  dia_semana text,
  fecha date,
  plato_general text,
  plato_opcional text,
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
    dm.plato_general,
    dm.plato_opcional,
    dm.notas_temperatura,
    (
      select p.tipo_menu
      from public.pedidos p
      where p.cliente_id = c.id and p.dia_menu_id = dm.id
    ) as eleccion_actual
  from public.clientes c
  join public.semanas s on s.activa = true
  join public.dias_menu dm on dm.semana_id = s.id
  where c.token = p_token and c.activo = true
  order by dm.fecha;
$$;

create or replace function submit_order(p_token text, p_dia_menu_id uuid, p_tipo text)
returns void
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_cliente_id uuid;
  v_dia_menu_id uuid;
begin
  if p_tipo not in ('general', 'opcional', 'no_come') then
    raise exception 'Tipo de menú inválido';
  end if;

  select id into v_cliente_id from public.clientes where token = p_token and activo = true;
  if v_cliente_id is null then
    raise exception 'Cliente no encontrado';
  end if;

  select dm.id into v_dia_menu_id
  from public.dias_menu dm
  join public.semanas s on s.id = dm.semana_id and s.activa = true
  where dm.id = p_dia_menu_id;
  if v_dia_menu_id is null then
    raise exception 'Día de menú no disponible';
  end if;

  insert into public.pedidos (cliente_id, dia_menu_id, tipo_menu)
  values (v_cliente_id, v_dia_menu_id, p_tipo)
  on conflict (cliente_id, dia_menu_id)
  do update set tipo_menu = excluded.tipo_menu;
end;
$$;

revoke all on function get_client_menu(text) from public;
revoke all on function submit_order(text, uuid, text) from public;
grant execute on function get_client_menu(text) to anon;
grant execute on function submit_order(text, uuid, text) to anon;

-- ============================================================
-- DATOS DE EJEMPLO (opcional, borrar o comentar en producción)
-- ============================================================
-- insert into semanas (fecha_inicio, precio_general, precio_opcional) values (current_date, 3500, 3800);
-- insert into clientes (nombre, telefono, cuidados_alimentarios) values ('Ana Gómez', '341...', 'sin sal');
