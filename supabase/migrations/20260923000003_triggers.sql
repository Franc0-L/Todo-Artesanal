-- =========================================================
-- Todo Artesanal v2 — Fase 4
-- 02_triggers.sql
--
-- Responsabilidad:
--   - inmutabilidad de versiones de catálogo;
--   - protección del ciclo de vida de semanas;
--   - validaciones transaccionales de pedidos;
--   - protección de opciones después de ser pedidas;
--   - exclusión mutua entre pedidos y cancelaciones.
--
-- NO incluye:
--   - RLS;
--   - configuración de administradores.
--
-- Depende de:
--   - schema-v1.sql
--   - 01_functions.sql
-- =========================================================


-- =========================================================
-- 1. INMUTABILIDAD DE DISH_VERSIONS
-- =========================================================
--
-- Una dish_version es un snapshot histórico.
-- Modificarla destruiría el significado de pedidos/ofertas
-- que referencien esa versión.
-- =========================================================

create or replace function private.prevent_dish_version_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Las versiones de platos son inmutables';
end;
$$;

create trigger dish_versions_immutable_update
before update on public.dish_versions
for each row
execute function private.prevent_dish_version_mutation();

create trigger dish_versions_immutable_delete
before delete on public.dish_versions
for each row
execute function private.prevent_dish_version_mutation();


-- =========================================================
-- 2. INMUTABILIDAD DE MENU_VERSIONS
-- =========================================================

create or replace function private.prevent_menu_version_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Las versiones de menús son inmutables';
end;
$$;

create trigger menu_versions_immutable_update
before update on public.menu_versions
for each row
execute function private.prevent_menu_version_mutation();

create trigger menu_versions_immutable_delete
before delete on public.menu_versions
for each row
execute function private.prevent_menu_version_mutation();


-- =========================================================
-- 3. MENU_VERSION_ITEMS — MÍNIMO DE UN MAIN
-- =========================================================
--
-- schema-v1 ya garantiza <= 1 main mediante un índice
-- UNIQUE parcial.
--
-- Este constraint trigger garantiza >= 1 main, y por lo
-- tanto, conjuntamente: exactamente 1 main.
--
-- DEFERRABLE INITIALLY DEFERRED porque construir una versión
-- de menú puede requerir varios INSERT dentro de la misma
-- transacción. No rechazamos estados intermedios válidos.
-- =========================================================

create or replace function private.validate_menu_version_has_main(
  p_menu_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not exists (
    select 1
    from public.menu_version_items
    where menu_version_id = p_menu_version_id
      and role = 'main'
  ) then
    raise exception
      'La versión de menú % debe tener exactamente un plato principal',
      p_menu_version_id;
  end if;
end;
$$;


create or replace function private.check_menu_version_main()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'INSERT' then
    perform private.validate_menu_version_has_main(
      new.menu_version_id
    );

  elsif tg_op = 'UPDATE' then
    perform private.validate_menu_version_has_main(
      new.menu_version_id
    );

    -- Si el item se movió de una versión a otra, verificar
    -- también que la versión anterior siga teniendo su main.
    if new.menu_version_id is distinct from old.menu_version_id then
      perform private.validate_menu_version_has_main(
        old.menu_version_id
      );
    end if;

  elsif tg_op = 'DELETE' then
    perform private.validate_menu_version_has_main(
      old.menu_version_id
    );
  end if;

  return null;
end;
$$;


create constraint trigger menu_version_items_require_main
after insert or update or delete
on public.menu_version_items
deferrable initially deferred
for each row
execute function private.check_menu_version_main();


-- =========================================================
-- 4. PROTECCIÓN DEL STATUS DE WEEKS
-- =========================================================
--
-- El estado de una semana no puede modificarse mediante un
-- UPDATE directo.
--
-- Las únicas transiciones permitidas por dominio son:
--
--   draft  → active
--   active → closed
--
-- activate_week() y close_week() habilitan temporalmente una
-- variable de sesión LOCAL antes de ejecutar su UPDATE.
--
-- is_local = true hace que la autorización desaparezca al
-- terminar la transacción actual.
-- =========================================================

create or replace function private.prevent_direct_week_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and coalesce(
       current_setting(
         'todo_artesanal.allow_week_transition',
         true
       ),
       'false'
     ) <> 'true'
  then
    raise exception
      'El estado de una semana solo puede modificarse mediante las funciones de dominio';
  end if;

  return new;
end;
$$;


create trigger weeks_status_protected
before update of status
on public.weeks
for each row
execute function private.prevent_direct_week_status_change();


-- =========================================================
-- 5. PROTECCIÓN DE SEMANAS CERRADAS
-- =========================================================
--
-- Una semana cerrada es histórica.
--
-- No se permite modificar ni eliminar información operativa
-- asociada a ella, ni insertar nuevos registros.
--
-- Tablas protegidas:
--   - week_days
--   - week_day_options
--   - orders
--   - cancellations
--
-- Cada función resuelve la semana mediante la relación
-- correspondiente y usa TG_OP para leer old/new según
-- corresponda (en DELETE, new no existe).
-- =========================================================


-- ---------------------------------------------------------
-- week_days
-- ---------------------------------------------------------

create or replace function private.prevent_closed_week_day_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_week_id := old.week_id;
  else
    v_week_id := new.week_id;
  end if;

  select status
  into v_status
  from public.weeks
  where id = v_week_id;

  if v_status = 'closed' then
    raise exception
      'No se puede modificar una semana cerrada';
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;


create trigger week_days_closed_protection
before insert or update or delete
on public.week_days
for each row
execute function private.prevent_closed_week_day_mutation();


-- ---------------------------------------------------------
-- week_day_options
-- ---------------------------------------------------------

create or replace function private.prevent_closed_week_day_option_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_day_id uuid;
  v_week_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_week_day_id := old.week_day_id;
  else
    v_week_day_id := new.week_day_id;
  end if;

  select wd.week_id
  into v_week_id
  from public.week_days wd
  where wd.id = v_week_day_id;

  select w.status
  into v_status
  from public.weeks w
  where w.id = v_week_id;

  if v_status = 'closed' then
    raise exception
      'No se puede modificar una opción de una semana cerrada';
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;


create trigger week_day_options_closed_protection
before insert or update or delete
on public.week_day_options
for each row
execute function private.prevent_closed_week_day_option_mutation();


-- ---------------------------------------------------------
-- orders
-- ---------------------------------------------------------

create or replace function private.prevent_closed_order_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_option_id uuid;
  v_week_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_option_id := old.week_day_option_id;
  else
    v_option_id := new.week_day_option_id;
  end if;

  select wd.week_id
  into v_week_id
  from public.week_day_options wdo
  join public.week_days wd
    on wd.id = wdo.week_day_id
  where wdo.id = v_option_id;

  select w.status
  into v_status
  from public.weeks w
  where w.id = v_week_id;

  if v_status = 'closed' then
    raise exception
      'No se puede modificar un pedido de una semana cerrada';
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;


create trigger orders_closed_protection
before insert or update or delete
on public.orders
for each row
execute function private.prevent_closed_order_mutation();


-- ---------------------------------------------------------
-- cancellations
-- ---------------------------------------------------------

create or replace function private.prevent_closed_cancellation_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_day_id uuid;
  v_week_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_week_day_id := old.week_day_id;
  else
    v_week_day_id := new.week_day_id;
  end if;

  select week_id
  into v_week_id
  from public.week_days
  where id = v_week_day_id;

  select status
  into v_status
  from public.weeks
  where id = v_week_id;

  if v_status = 'closed' then
    raise exception
      'No se puede modificar una cancelación de una semana cerrada';
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;


create trigger cancellations_closed_protection
before insert or update or delete
on public.cancellations
for each row
execute function private.prevent_closed_cancellation_mutation();


-- =========================================================
-- 6. ORDERS — VALIDACIÓN Y CONGELAMIENTO DEL PRECIO
-- =========================================================
--
-- INSERT:
--   - semana active;
--   - cliente en week_expected_clients;
--   - applied_price calculado en backend.
--
-- UPDATE:
--   - solo quantity y notes editables;
--   - applied_price no puede cambiar;
--   - client_id, week_day_option_id, modality no editables.
--
-- DELETE:
--   - permitido mientras la semana no esté closed
--     (protección anterior).
-- =========================================================

create or replace function private.validate_order()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_id uuid;
  v_week_status text;
  v_expected boolean;
begin
  -- -------------------------------------------------------
  -- Determinar semana de la opción.
  -- -------------------------------------------------------
  select wd.week_id
  into v_week_id
  from public.week_day_options wdo
  join public.week_days wd
    on wd.id = wdo.week_day_id
  where wdo.id = new.week_day_option_id;

  if not found then
    raise exception
      'La opción de día % no existe',
      new.week_day_option_id;
  end if;


  -- -------------------------------------------------------
  -- La operación de pedido solamente puede ocurrir durante
  -- una semana active.
  -- -------------------------------------------------------
  select w.status
  into v_week_status
  from public.weeks w
  where w.id = v_week_id;

  if v_week_status <> 'active' then
    raise exception
      'Solo se pueden gestionar pedidos de una semana activa';
  end if;


  -- -------------------------------------------------------
  -- El cliente debe formar parte de la población congelada
  -- al momento de activar la semana.
  -- -------------------------------------------------------
  select exists (
    select 1
    from public.week_expected_clients wec
    where wec.week_id = v_week_id
      and wec.client_id = new.client_id
  )
  into v_expected;

  if not v_expected then
    raise exception
      'El cliente % no pertenece a los clientes esperados de la semana',
      new.client_id;
  end if;


  -- -------------------------------------------------------
  -- INSERT: calcular applied_price.
  -- -------------------------------------------------------
  if tg_op = 'INSERT' then
    new.applied_price := public.calculate_order_price(
      new.client_id,
      new.week_day_option_id,
      new.modality
    );

    return new;
  end if;


  -- -------------------------------------------------------
  -- UPDATE: solo quantity y notes son editables.
  -- -------------------------------------------------------
  if tg_op = 'UPDATE' then

    if new.client_id is distinct from old.client_id then
      raise exception
        'client_id no puede modificarse en un pedido';
    end if;

    if new.week_day_option_id is distinct from old.week_day_option_id then
      raise exception
        'week_day_option_id no puede modificarse en un pedido';
    end if;

    if new.modality is distinct from old.modality then
      raise exception
        'modality no puede modificarse en un pedido';
    end if;

    if new.applied_price is distinct from old.applied_price then
      raise exception
        'applied_price no puede modificarse en un pedido';
    end if;

    return new;
  end if;


  return new;
end;
$$;


create trigger orders_validate_insert_update
before insert or update
on public.orders
for each row
execute function private.validate_order();


-- =========================================================
-- 7. WEEK_DAY_OPTIONS — CONGELAMIENTO POST-PEDIDO
-- =========================================================
--
-- Una opción que ya fue utilizada por un pedido no puede
-- modificarse ni eliminarse.
--
-- Esto evita que el significado de un pedido histórico cambie
-- indirectamente modificando la oferta a la que apunta.
--
-- Cierra el gap de la invariante #15 dentro de semanas active
-- (la protección de closed ya cubre las semanas cerradas).
-- =========================================================

create or replace function private.prevent_ordered_option_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_option_id uuid;
begin
  if tg_op = 'DELETE' then
    v_option_id := old.id;
  else
    v_option_id := new.id;
  end if;

  if exists (
    select 1
    from public.orders o
    where o.week_day_option_id = v_option_id
  ) then
    raise exception
      'No se puede modificar o eliminar una opción que ya tiene pedidos asociados';
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;


create trigger week_day_options_order_freeze
before update or delete
on public.week_day_options
for each row
execute function private.prevent_ordered_option_mutation();


-- =========================================================
-- 8. CANCELLATIONS — EXCLUSIÓN CON ORDERS
-- =========================================================
--
-- Una cancelación representa la respuesta del cliente para
-- un día completo.
--
-- No puede coexistir con ningún pedido de ese mismo cliente
-- para ese mismo día.
-- =========================================================

create or replace function private.prevent_cancellation_with_order()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_client_id uuid;
  v_week_day_id uuid;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  v_client_id := new.client_id;
  v_week_day_id := new.week_day_id;

  if exists (
    select 1
    from public.orders o
    join public.week_day_options wdo
      on wdo.id = o.week_day_option_id
    where o.client_id = v_client_id
      and wdo.week_day_id = v_week_day_id
  ) then
    raise exception
      'El cliente ya tiene un pedido para ese día y no puede registrarse una cancelación';
  end if;

  return new;
end;
$$;


create trigger cancellations_no_order
before insert or update
on public.cancellations
for each row
execute function private.prevent_cancellation_with_order();


-- =========================================================
-- 9. ORDERS — EXCLUSIÓN CON CANCELLATIONS
-- =========================================================
--
-- La comprobación inversa evita que aparezca un pedido cuando
-- ya existe una cancelación del mismo cliente para ese día.
-- =========================================================

create or replace function private.prevent_order_with_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_client_id uuid;
  v_option_id uuid;
  v_week_day_id uuid;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  v_client_id := new.client_id;
  v_option_id := new.week_day_option_id;

  select wd.id
  into v_week_day_id
  from public.week_day_options wdo
  join public.week_days wd
    on wd.id = wdo.week_day_id
  where wdo.id = v_option_id;

  if exists (
    select 1
    from public.cancellations c
    where c.client_id = v_client_id
      and c.week_day_id = v_week_day_id
  ) then
    raise exception
      'El cliente tiene una cancelación para ese día y no puede registrarse un pedido';
  end if;

  return new;
end;
$$;


create trigger orders_no_cancellation
before insert or update
on public.orders
for each row
execute function private.prevent_order_with_cancellation();