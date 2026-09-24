-- =========================================================
-- Todo Artesanal v2 — Fase 4
-- 01_functions.sql
--
-- Responsabilidad:
--   - Funciones de dominio reutilizables.
--
-- NO incluye:
--   - triggers
--   - RLS
--   - creación/configuración de administradores
--
-- Orden de aplicación:
--   schema-v1.sql
--   01_functions.sql   ← este archivo
--   02_triggers.sql
--   03_rls.sql
--   04_admin_setup.sql
-- =========================================================


create schema if not exists private;


-- =========================================================
-- 1. CALCULATE ORDER PRICE
-- =========================================================
--
-- Calcula el precio UNITARIO aplicable a una selección.
--
-- Precedencia para una opción DISH:
--   1. client_product_prices
--   2. client_prices[modalidad]
--   3. dish_versions.price
--
-- Precedencia para una opción MENU:
--   1. client_prices[modalidad]
--   2. menu_versions.price
--
-- Importante:
--   client_product_prices NO aplica a menús.
--
-- Media vianda:
--   - no tiene precio especial propio;
--   - se calcula sobre la rama GENERAL;
--   - para un dish:
--       client_product_prices
--       > client_prices[general]
--       > dish_versions.price
--   - para un menu:
--       client_prices[general]
--       > menu_versions.price
--   - finalmente se divide por 2.
--
-- La función valida:
--   - existencia del cliente;
--   - existencia de la opción;
--   - semana activa;
--   - allows_half_portion para media_vianda.
-- =========================================================

create or replace function public.calculate_order_price(
  p_client_id uuid,
  p_week_day_option_id uuid,
  p_modality text
)
returns numeric(10,2)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_allows_half_portion boolean;

  v_week_status text;
  v_option_type text;

  v_dish_id uuid;
  v_base_price numeric(10,2);

  v_client_price numeric(10,2);
  v_product_price numeric(10,2);

  v_normal_price numeric(10,2);
begin
  -- -------------------------------------------------------
  -- La función debe rechazar modalidades inválidas incluso
  -- cuando sea invocada directamente, sin pasar por orders.
  -- -------------------------------------------------------
  if p_modality not in ('general', 'opcional', 'media_vianda') then
    raise exception
      'Modalidad de pedido inválida: %',
      p_modality;
  end if;


  -- -------------------------------------------------------
  -- El cliente debe existir.
  -- -------------------------------------------------------
  select c.allows_half_portion
  into v_allows_half_portion
  from public.clients c
  where c.id = p_client_id;

  if not found then
    raise exception
      'El cliente % no existe',
      p_client_id;
  end if;


  -- -------------------------------------------------------
  -- Media vianda solamente está disponible para clientes
  -- que tengan habilitada explícitamente esta modalidad.
  -- -------------------------------------------------------
  if p_modality = 'media_vianda'
     and not v_allows_half_portion then

    raise exception
      'El cliente % no tiene habilitada la modalidad media_vianda',
      p_client_id;
  end if;


  -- -------------------------------------------------------
  -- Obtener la opción y su semana.
  --
  -- v_dish_id:
  --   - opción dish → dish_id real;
  --   - opción menu → NULL deliberadamente.
  --
  -- Esto es importante porque client_product_prices aplica
  -- solamente a platos individuales y nunca sustituye el
  -- precio de una menu_version.
  -- -------------------------------------------------------
  select
    w.status,
    wdo.option_type,
    case
      when wdo.option_type = 'dish'
        then dv.dish_id
      else null
    end,
    case
      when wdo.option_type = 'dish'
        then dv.price
      when wdo.option_type = 'menu'
        then mv.price
    end
  into
    v_week_status,
    v_option_type,
    v_dish_id,
    v_base_price
  from public.week_day_options wdo
  join public.week_days wd
    on wd.id = wdo.week_day_id
  join public.weeks w
    on w.id = wd.week_id
  left join public.dish_versions dv
    on wdo.option_type = 'dish'
   and dv.id = wdo.dish_version_id
  left join public.menu_versions mv
    on wdo.option_type = 'menu'
   and mv.id = wdo.menu_version_id
  where wdo.id = p_week_day_option_id;

  if not found then
    raise exception
      'La opción de oferta % no existe',
      p_week_day_option_id;
  end if;


  -- -------------------------------------------------------
  -- Los pedidos solamente pueden realizarse sobre una
  -- semana activa.
  -- -------------------------------------------------------
  if v_week_status <> 'active' then
    raise exception
      'La semana de la opción % no está activa',
      p_week_day_option_id;
  end if;


  -- -------------------------------------------------------
  -- Precio específico por plato.
  --
  -- Se consulta únicamente para opciones DISH.
  -- Para MENU v_dish_id es NULL y esta consulta no puede
  -- encontrar/aplicar un precio específico de plato.
  -- -------------------------------------------------------
  if v_option_type = 'dish' then
    select cpp.price
    into v_product_price
    from public.client_product_prices cpp
    where cpp.client_id = p_client_id
      and cpp.dish_id = v_dish_id;
  end if;


  -- -------------------------------------------------------
  -- MEDIA VIANDA
  --
  -- Siempre parte de la rama GENERAL.
  --
  -- DISH:
  --   precio específico del plato
  --   > precio general del cliente
  --   > precio base del plato
  --
  -- MENU:
  --   precio general del cliente
  --   > precio base del menú
  --
  -- Nunca se utiliza client_prices['opcional'].
  -- -------------------------------------------------------
  if p_modality = 'media_vianda' then

    select cp.price
    into v_client_price
    from public.client_prices cp
    where cp.client_id = p_client_id
      and cp.modality = 'general';

    if v_option_type = 'dish' then
      v_normal_price := coalesce(
        v_product_price,
        v_client_price,
        v_base_price
      );
    else
      v_normal_price := coalesce(
        v_client_price,
        v_base_price
      );
    end if;

    if v_normal_price is null then
      raise exception
        'No se pudo determinar el precio para la opción %',
        p_week_day_option_id;
    end if;

    return round(v_normal_price / 2, 2)::numeric(10,2);
  end if;


  -- -------------------------------------------------------
  -- GENERAL / OPCIONAL
  --
  -- DISH:
  --   precio específico del plato
  --   > precio especial de modalidad
  --   > precio base
  --
  -- MENU:
  --   precio especial de modalidad
  --   > precio base del menú
  -- -------------------------------------------------------
  select cp.price
  into v_client_price
  from public.client_prices cp
  where cp.client_id = p_client_id
    and cp.modality = p_modality;


  if v_option_type = 'dish' then
    v_normal_price := coalesce(
      v_product_price,
      v_client_price,
      v_base_price
    );
  else
    v_normal_price := coalesce(
      v_client_price,
      v_base_price
    );
  end if;

  if v_normal_price is null then
    raise exception
      'No se pudo determinar el precio para la opción %',
      p_week_day_option_id;
  end if;

  return v_normal_price::numeric(10,2);
end;
$$;


-- =========================================================
-- 2. ACTIVATE WEEK
-- =========================================================
--
-- Transición válida:
--
--   draft → active
--
-- Validaciones:
--   - ejecutor es admin;
--   - semana existente;
--   - estado draft;
--   - no existe otra semana active;
--   - exactamente 5 días;
--   - cada día tiene al menos una opción;
--   - cada menu_version utilizada tiene exactamente un main;
--   - congelar clients.active en week_expected_clients.
--
-- La población esperada queda congelada al momento de
-- activación y posteriormente no depende de clients.active.
--
-- El UPDATE final usa una variable de sesión LOCAL para
-- que el trigger de weeks.status permita la transición.
-- =========================================================

create or replace function public.activate_week(
  p_week_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_status text;
  v_day_count integer;
  v_empty_day_count integer;
  v_invalid_menu_count integer;
begin
  -- -------------------------------------------------------
  -- Solamente administradores pueden ejecutar operaciones
  -- del ciclo de vida de una semana.
  -- -------------------------------------------------------
  if not private.is_admin() then
    raise exception
      'Solo administradores pueden activar semanas';
  end if;


  -- -------------------------------------------------------
  -- Obtener y validar la semana.
  -- -------------------------------------------------------
  select w.status
  into v_status
  from public.weeks w
  where w.id = p_week_id;

  if not found then
    raise exception
      'La semana % no existe',
      p_week_id;
  end if;

  if v_status <> 'draft' then
    raise exception
      'Solo se puede activar una semana en estado draft. Estado actual: %',
      v_status;
  end if;


  -- -------------------------------------------------------
  -- Evitar depender del error del índice unique parcial
  -- weeks_one_active_idx.
  -- -------------------------------------------------------
  if exists (
    select 1
    from public.weeks
    where status = 'active'
      and id <> p_week_id
  ) then
    raise exception
      'Ya existe otra semana activa';
  end if;


  -- -------------------------------------------------------
  -- Una semana operativa debe tener exactamente los cinco
  -- días laborales definidos por el dominio.
  -- -------------------------------------------------------
  select count(*)
  into v_day_count
  from public.week_days wd
  where wd.week_id = p_week_id;

  if v_day_count <> 5 then
    raise exception
      'La semana debe tener exactamente 5 días para activarse. Tiene %',
      v_day_count;
  end if;


  -- -------------------------------------------------------
  -- Cada día debe tener al menos una opción de oferta.
  -- -------------------------------------------------------
  select count(*)
  into v_empty_day_count
  from public.week_days wd
  where wd.week_id = p_week_id
    and not exists (
      select 1
      from public.week_day_options wdo
      where wdo.week_day_id = wd.id
    );

  if v_empty_day_count > 0 then
    raise exception
      'No se puede activar la semana: existen % días sin opciones de oferta',
      v_empty_day_count;
  end if;


  -- -------------------------------------------------------
  -- Toda menu_version utilizada por la semana debe tener
  -- exactamente un plato principal.
  --
  -- El índice parcial de schema-v1 ya impide > 1 main.
  -- Esta validación garantiza además que exista al menos uno.
  -- -------------------------------------------------------
  select count(*)
  into v_invalid_menu_count
  from (
    select distinct wdo.menu_version_id
    from public.week_day_options wdo
    join public.week_days wd
      on wd.id = wdo.week_day_id
    where wd.week_id = p_week_id
      and wdo.option_type = 'menu'
  ) used_menus
  where (
    select count(*)
    from public.menu_version_items mvi
    where mvi.menu_version_id = used_menus.menu_version_id
      and mvi.role = 'main'
  ) <> 1;

  if v_invalid_menu_count > 0 then
    raise exception
      'No se puede activar la semana: existen % versiones de menú utilizadas sin exactamente un plato principal',
      v_invalid_menu_count;
  end if;


  -- -------------------------------------------------------
  -- Congelar la población esperada.
  --
  -- Se toma clients.active en este instante.
  -- -------------------------------------------------------
  insert into public.week_expected_clients (
    week_id,
    client_id
  )
  select
    p_week_id,
    c.id
  from public.clients c
  where c.active = true;


  -- -------------------------------------------------------
  -- Autorizar el cambio de status para el trigger de weeks.
  --
  -- is_local = true hace que la bandera desaparezca al
  -- finalizar la transacción.
  -- -------------------------------------------------------
  perform set_config(
    'todo_artesanal.allow_week_transition',
    'true',
    true
  );


  -- -------------------------------------------------------
  -- La transición de estado se realiza al final.
  -- -------------------------------------------------------
  update public.weeks
  set
    status = 'active',
    updated_at = now()
  where id = p_week_id;
end;
$$;


-- =========================================================
-- 3. CLOSE WEEK
-- =========================================================
--
-- Transición válida:
--
--   active → closed
--
-- closed es terminal.
--
-- La protección efectiva de las tablas históricas se
-- implementa en 02_triggers.sql.
-- =========================================================

create or replace function public.close_week(
  p_week_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_status text;
begin
  -- -------------------------------------------------------
  -- Solamente administradores pueden cerrar semanas.
  -- -------------------------------------------------------
  if not private.is_admin() then
    raise exception
      'Solo administradores pueden cerrar semanas';
  end if;


  -- -------------------------------------------------------
  -- Obtener y validar la semana.
  -- -------------------------------------------------------
  select w.status
  into v_status
  from public.weeks w
  where w.id = p_week_id;

  if not found then
    raise exception
      'La semana % no existe',
      p_week_id;
  end if;


  -- -------------------------------------------------------
  -- No se permite saltar de draft a closed y closed es
  -- terminal.
  -- -------------------------------------------------------
  if v_status <> 'active' then
    raise exception
      'Solo se puede cerrar una semana en estado active. Estado actual: %',
      v_status;
  end if;


  -- -------------------------------------------------------
  -- Autorizar el cambio de status para el trigger de weeks.
  -- -------------------------------------------------------
  perform set_config(
    'todo_artesanal.allow_week_transition',
    'true',
    true
  );


  -- -------------------------------------------------------
  -- Transición: active → closed
  -- -------------------------------------------------------
  update public.weeks
  set
    status = 'closed',
    updated_at = now()
  where id = p_week_id;
end;
$$;