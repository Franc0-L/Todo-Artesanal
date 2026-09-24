-- =========================================================
-- Todo Artesanal v2 — Fase 4
-- 03_rls.sql
--
-- Responsabilidad:
--   - schema privado de seguridad;
--   - administradores;
--   - funciones auxiliares de identidad;
--   - RLS;
--   - policies de administrador;
--   - policies de cliente;
--   - grants.
--
-- NO incluye:
--   - triggers;
--   - lógica de negocio de pedidos;
--   - inserción del primer administrador.
--
-- Orden de aplicación:
--   schema-v1.sql
--   01_functions.sql
--   02_triggers.sql
--   03_rls.sql          ← este archivo
--   04_admin_setup.sql
-- =========================================================


-- =========================================================
-- 1. PRIVATE SCHEMA
-- =========================================================
--
-- El schema private contiene exclusivamente infraestructura
-- de seguridad que no debe formar parte de la API pública.
-- =========================================================

create schema if not exists private;


-- =========================================================
-- 2. ADMIN USERS
-- =========================================================
--
-- La existencia de esta tabla es necesaria antes de crear
-- las policies que utilizan private.is_admin().
--
-- El primer administrador se inserta posteriormente en
-- 04_admin_setup.sql.
-- =========================================================

create table if not exists private.admin_users (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade
);


-- =========================================================
-- 3. IS_ADMIN()
-- =========================================================
--
-- Determina si el usuario autenticado actual es administrador.
--
-- SECURITY DEFINER permite consultar la tabla privada sin
-- depender de permisos/RLS del caller.
--
-- search_path explícito evita resolución accidental de objetos.
-- =========================================================

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select exists (
    select 1
    from private.admin_users
    where user_id = auth.uid()
  );
$$;


revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;


-- =========================================================
-- 4. CURRENT_CLIENT_ID()
-- =========================================================
--
-- El cliente se identifica mediante el claim client_id
-- incluido en el JWT.
--
-- No se consulta clients para obtener la identidad: el claim
-- es la identidad de cliente utilizada por las policies.
--
-- Comportamiento defensivo: si el claim no existe, está vacío
-- o no es un UUID válido, devuelve NULL en lugar de lanzar
-- excepción. Esto evita que un JWT malformado rompa todas las
-- queries del cliente.
-- =========================================================

create or replace function private.current_client_id()
returns uuid
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_raw text;
begin
  v_raw := auth.jwt() ->> 'client_id';

  if v_raw is null or v_raw = '' then
    return null;
  end if;

  begin
    return v_raw::uuid;
  exception when others then
    return null;
  end;
end;
$$;


revoke all on function private.current_client_id() from public;
grant execute on function private.current_client_id() to authenticated;


-- =========================================================
-- 5. RLS — TODAS LAS TABLAS
-- =========================================================
--
-- Todas las tablas quedan protegidas por RLS.
--
-- admin_users también queda protegida, pero su función
-- SECURITY DEFINER permite que is_admin() la consulte.
-- =========================================================

alter table public.clients enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_versions enable row level security;

alter table public.menus enable row level security;
alter table public.menu_versions enable row level security;
alter table public.menu_version_items enable row level security;

alter table public.weeks enable row level security;
alter table public.week_days enable row level security;
alter table public.week_day_options enable row level security;

alter table public.week_expected_clients enable row level security;

alter table public.client_prices enable row level security;
alter table public.client_product_prices enable row level security;
alter table public.client_tokens enable row level security;

alter table public.orders enable row level security;
alter table public.cancellations enable row level security;

alter table private.admin_users enable row level security;


-- =========================================================
-- 6. ADMIN POLICIES
-- =========================================================
--
-- Un administrador tiene acceso completo a las 15 tablas
-- públicas.
--
-- No se crea policy de cliente sobre client_tokens:
-- solamente los administradores pueden acceder.
-- =========================================================


create policy clients_admin_all
on public.clients
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy dishes_admin_all
on public.dishes
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy dish_versions_admin_all
on public.dish_versions
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy menus_admin_all
on public.menus
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy menu_versions_admin_all
on public.menu_versions
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy menu_version_items_admin_all
on public.menu_version_items
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy weeks_admin_all
on public.weeks
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy week_days_admin_all
on public.week_days
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy week_day_options_admin_all
on public.week_day_options
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy week_expected_clients_admin_all
on public.week_expected_clients
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy client_prices_admin_all
on public.client_prices
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy client_product_prices_admin_all
on public.client_product_prices
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy client_tokens_admin_all
on public.client_tokens
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy orders_admin_all
on public.orders
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


create policy cancellations_admin_all
on public.cancellations
for all to authenticated
using (private.is_admin())
with check (private.is_admin());


-- =========================================================
-- 7. CLIENT — CLIENTS
-- =========================================================
--
-- El cliente solamente puede consultar su propia ficha.
-- No se concede UPDATE.
-- =========================================================

create policy clients_client_select
on public.clients
for select
to authenticated
using (
  id = private.current_client_id()
);


-- =========================================================
-- 8. CLIENT — ACTIVE OFFER
-- =========================================================
--
-- Los clientes solamente pueden consultar la oferta de la
-- semana actualmente activa.
-- =========================================================

create policy weeks_client_select_active
on public.weeks
for select
to authenticated
using (
  status = 'active'
);


create policy week_days_client_select_active
on public.week_days
for select
to authenticated
using (
  exists (
    select 1
    from public.weeks w
    where w.id = week_days.week_id
      and w.status = 'active'
  )
);


create policy week_day_options_client_select_active
on public.week_day_options
for select
to authenticated
using (
  exists (
    select 1
    from public.week_days wd
    join public.weeks w
      on w.id = wd.week_id
    where wd.id = week_day_options.week_day_id
      and w.status = 'active'
  )
);


-- =========================================================
-- 9. CLIENT — DISH VERSIONS
-- =========================================================
--
-- No se exponen todas las versiones históricas. Solo las
-- que forman parte de una opción de la semana activa, ya sea
-- directamente o como componente de un menú ofrecido.
-- =========================================================

create policy dish_versions_client_select_active
on public.dish_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.week_day_options wdo
    join public.week_days wd
      on wd.id = wdo.week_day_id
    join public.weeks w
      on w.id = wd.week_id
    where w.status = 'active'
      and wdo.option_type = 'dish'
      and wdo.dish_version_id = dish_versions.id
  )
  or
  exists (
    select 1
    from public.week_day_options wdo
    join public.week_days wd
      on wd.id = wdo.week_day_id
    join public.weeks w
      on w.id = wd.week_id
    join public.menu_version_items mvi
      on mvi.menu_version_id = wdo.menu_version_id
    where w.status = 'active'
      and wdo.option_type = 'menu'
      and mvi.dish_version_id = dish_versions.id
  )
);


-- =========================================================
-- 10. CLIENT — MENU VERSIONS
-- =========================================================

create policy menu_versions_client_select_active
on public.menu_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.week_day_options wdo
    join public.week_days wd
      on wd.id = wdo.week_day_id
    join public.weeks w
      on w.id = wd.week_id
    where w.status = 'active'
      and wdo.option_type = 'menu'
      and wdo.menu_version_id = menu_versions.id
  )
);


-- =========================================================
-- 11. CLIENT — MENU VERSION ITEMS
-- =========================================================

create policy menu_version_items_client_select_active
on public.menu_version_items
for select
to authenticated
using (
  exists (
    select 1
    from public.week_day_options wdo
    join public.week_days wd
      on wd.id = wdo.week_day_id
    join public.weeks w
      on w.id = wd.week_id
    where w.status = 'active'
      and wdo.option_type = 'menu'
      and wdo.menu_version_id = menu_version_items.menu_version_id
  )
);


-- =========================================================
-- 12. CLIENT — ORDERS
-- =========================================================
--
-- El cliente puede SELECT/INSERT/UPDATE sus propios pedidos.
-- DELETE no tiene policy de cliente (operación administrativa).
--
-- Validaciones de semana active, cliente esperado, cálculo de
-- precio y campos inmutables están reforzadas por triggers.
-- =========================================================

create policy orders_client_select_own
on public.orders
for select
to authenticated
using (
  client_id = private.current_client_id()
);


create policy orders_client_insert_own
on public.orders
for insert
to authenticated
with check (
  client_id = private.current_client_id()
);


create policy orders_client_update_own
on public.orders
for update
to authenticated
using (
  client_id = private.current_client_id()
)
with check (
  client_id = private.current_client_id()
);


-- =========================================================
-- 13. CLIENT — CANCELLATIONS
-- =========================================================

create policy cancellations_client_select_own
on public.cancellations
for select
to authenticated
using (
  client_id = private.current_client_id()
);


create policy cancellations_client_insert_own
on public.cancellations
for insert
to authenticated
with check (
  client_id = private.current_client_id()
);


create policy cancellations_client_update_own
on public.cancellations
for update
to authenticated
using (
  client_id = private.current_client_id()
)
with check (
  client_id = private.current_client_id()
);


-- =========================================================
-- 14. CLIENT — CLIENT PRICES
-- =========================================================

create policy client_prices_client_select_own
on public.client_prices
for select
to authenticated
using (
  client_id = private.current_client_id()
);


-- =========================================================
-- 15. CLIENT — CLIENT PRODUCT PRICES
-- =========================================================

create policy client_product_prices_client_select_own
on public.client_product_prices
for select
to authenticated
using (
  client_id = private.current_client_id()
);


-- =========================================================
-- 16. TABLAS SIN ACCESO DE CLIENTE
-- =========================================================
--
-- No se crean policies de cliente para:
--
--   client_tokens
--   week_expected_clients
--   dishes
--   menus
--
-- Por lo tanto, los clientes no pueden acceder a ellas.
--
-- Nota: el cliente no puede filtrar por category ni climate.
-- Si en el futuro se necesitan filtros, agregar policy sobre
-- dishes.
-- =========================================================


-- =========================================================
-- 17. ADMIN_USERS
-- =========================================================
--
-- No se otorga acceso directo a authenticated.
-- is_admin() consulta la tabla como SECURITY DEFINER.
-- =========================================================

revoke all on table private.admin_users from public;
revoke all on table private.admin_users from authenticated;


-- =========================================================
-- 18. SCHEMA USAGE
-- =========================================================
--
-- Otorgar usage sobre el schema private a authenticated para
-- que las funciones helper (is_admin, current_client_id)
-- puedan ser invocadas desde las policies sin problemas de
-- permisos.
-- =========================================================

grant usage on schema private to authenticated;


-- =========================================================
-- 19. TABLE GRANTS
-- =========================================================
--
-- RLS decide qué filas puede utilizar cada usuario.
-- Los grants determinan qué operaciones puede intentar.
--
-- Se concede acceso de tabla al rol authenticated para las
-- tablas públicas y RLS limita las filas/operaciones.
-- =========================================================

grant select, insert, update, delete
on public.clients,
   public.dishes,
   public.dish_versions,
   public.menus,
   public.menu_versions,
   public.menu_version_items,
   public.weeks,
   public.week_days,
   public.week_day_options,
   public.week_expected_clients,
   public.client_prices,
   public.client_product_prices,
   public.client_tokens,
   public.orders,
   public.cancellations
to authenticated;


-- =========================================================
-- 20. SERVICE_ROLE GRANTS (defensivos)
-- =========================================================
--
-- service_role bypassea RLS. Igual conviene asegurar los
-- grants básicos para evitar "permission denied" si una Edge
-- Function necesita acceso directo.
-- =========================================================

grant usage on schema public to service_role;
grant usage on schema private to service_role;

grant all on all tables in schema public to service_role;
grant all on all functions in schema public to service_role;


-- =========================================================
-- 21. FUNCTION GRANTS — SEGURIDAD
-- =========================================================
--
-- calculate_order_price es SECURITY DEFINER y NO se otorga
-- a authenticated: un cliente podría invocarla con el
-- client_id de otro cliente y obtener el precio aplicable,
-- filtrando información de precios especiales ajenos.
--
-- Los triggers de orders la invocan internamente (los
-- triggers corren con permisos del owner de la función, no
-- del caller), así que no necesita grant para funcionar.
--
-- Si el frontend necesita mostrar un precio previo al
-- pedido, se debe crear una función wrapper que valide al
-- cliente contra current_client_id(). Esto queda pendiente
-- para Fase 5.
-- =========================================================

revoke all on function public.calculate_order_price(
  uuid,
  uuid,
  text
) from public;

revoke all on function public.calculate_order_price(
  uuid,
  uuid,
  text
) from authenticated;


-- =========================================================
-- FIN 03_rls.sql
-- =========================================================