-- =========================================================
-- Todo Artesanal v2 — Fase 5C
-- 20260924000001_menu_rpc.sql
--
-- Responsabilidad:
--   - RPCs para crear un menú (identidad + versión 1 + items) y
--     para crear una nueva versión de un menú existente, cada una
--     en una única transacción de PostgreSQL.
--
-- NO incluye:
--   - triggers (viven en 02_triggers.sql, no se tocan);
--   - RLS (vive en 03_rls.sql, no se toca);
--   - modificaciones a 01_functions.sql.
--
-- Contexto:
--   menu_versions tiene un trigger BEFORE DELETE que rechaza
--   incondicionalmente cualquier borrado (ver 02_triggers.sql,
--   sección 2). menu_version_items solo puede insertarse después
--   de que la versión exista (FK a menu_version_id). El patrón de
--   "insertar + rollback manual si falla" que funciona para
--   dishes (dishes.service.ts) es inviable acá: si el INSERT de
--   items falla después de insertada la versión, esa versión
--   queda huérfana e inmutable para siempre — no se puede borrar
--   la versión (trigger) ni la identidad del menú (menu_versions
--   no tiene ON DELETE CASCADE hacia menus, así que la FK lo
--   impide mientras la versión exista).
--
--   Ambas funciones resuelven esto insertando todo dentro de la
--   transacción implícita de la función. El constraint trigger
--   diferible menu_version_items_require_main (DEFERRABLE
--   INITIALLY DEFERRED) se dispara al COMMIT de esa transacción:
--   si la composición insertada no tiene exactamente 1 main, todo
--   se revierte, versión incluida. Estas funciones además
--   validan lo mismo por adelantado, para dar un mensaje de error
--   más claro sin depender únicamente del trigger.
--
-- Grants: sin revoke/grant explícito, igual que activate_week y
-- close_week en 01_functions.sql. La única barrera es is_admin().
-- Deliberadamente distinto de calculate_order_price, que sí se
-- revoca en 03_rls.sql sección 21 por riesgo de fuga de datos
-- que acá no aplica.
--
-- Orden de aplicación: después de 20260923000005_admin_setup.sql.
-- =========================================================


-- =========================================================
-- 1. CREATE_MENU
-- =========================================================
--
-- Crea la identidad de un menú junto con su primera versión
-- (version_number = 1) y su composición, en una única
-- transacción.
--
-- p_items: array jsonb de objetos:
--   [{"dish_version_id": "uuid", "role": "main"|"side"}, ...]
--
-- Validaciones:
--   - ejecutor es admin;
--   - p_name no vacío;
--   - p_price >= 0;
--   - p_items es un array jsonb no vacío;
--   - cada elemento tiene dish_version_id (uuid válido) y role
--     ('main' | 'side');
--   - cada dish_version_id referenciado existe;
--   - exactamente 1 elemento con role = 'main';
--   - no hay dish_version_id repetidos (coherente con el
--     UNIQUE (menu_version_id, dish_version_id) de la tabla).
-- =========================================================

create or replace function public.create_menu(
  p_name text,
  p_price numeric,
  p_items jsonb,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_menu_id uuid;
  v_menu_version_id uuid;
  v_item_count integer;
  v_distinct_dish_version_count integer;
  v_main_count integer := 0;
  v_item jsonb;
  v_dish_version_id uuid;
  v_role text;
begin
  if not private.is_admin() then
    raise exception
      'Solo administradores pueden crear menús';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception
      'El nombre del menú no puede estar vacío';
  end if;

  if p_price is null or p_price < 0 then
    raise exception
      'El precio debe ser mayor o igual a 0';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception
      'p_items debe ser un array jsonb';
  end if;

  select
    count(*),
    count(distinct elem ->> 'dish_version_id')
  into
    v_item_count,
    v_distinct_dish_version_count
  from jsonb_array_elements(p_items) as elem;

  if v_item_count = 0 then
    raise exception
      'El menú debe tener al menos un ítem (el plato principal)';
  end if;

  if v_distinct_dish_version_count <> v_item_count then
    raise exception
      'No se puede repetir el mismo dish_version_id dentro del menú';
  end if;

  -- -------------------------------------------------------
  -- Validar forma de cada ítem, existencia del dish_version_id
  -- referenciado, y contar los role='main'.
  -- -------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if not jsonb_exists(v_item, 'dish_version_id')
       or not jsonb_exists(v_item, 'role') then
      raise exception
        'Cada ítem debe tener dish_version_id y role';
    end if;

    begin
      v_dish_version_id := (v_item ->> 'dish_version_id')::uuid;
    exception when others then
      raise exception
        'dish_version_id inválido: %',
        v_item ->> 'dish_version_id';
    end;

    v_role := v_item ->> 'role';

    if v_role not in ('main', 'side') then
      raise exception
        'role debe ser "main" o "side", recibido: %',
        v_role;
    end if;

    if not exists (
      select 1 from public.dish_versions dv
      where dv.id = v_dish_version_id
    ) then
      raise exception
        'dish_version_id % no existe',
        v_dish_version_id;
    end if;

    if v_role = 'main' then
      v_main_count := v_main_count + 1;
    end if;
  end loop;

  if v_main_count <> 1 then
    raise exception
      'El menú debe tener exactamente 1 ítem con role=main. Recibidos: %',
      v_main_count;
  end if;

  -- -------------------------------------------------------
  -- Inserciones. Si algo falla desde acá — incluido el trigger
  -- diferible al COMMIT — toda la transacción se revierte.
  -- -------------------------------------------------------

  insert into public.menus (active)
  values (coalesce(p_active, true))
  returning id into v_menu_id;

  insert into public.menu_versions (
    menu_id,
    version_number,
    name,
    price
  )
  values (
    v_menu_id,
    1,
    btrim(p_name),
    p_price
  )
  returning id into v_menu_version_id;

  insert into public.menu_version_items (
    menu_version_id,
    dish_version_id,
    role
  )
  select
    v_menu_version_id,
    (elem ->> 'dish_version_id')::uuid,
    elem ->> 'role'
  from jsonb_array_elements(p_items) as elem;

  return v_menu_id;
end;
$$;


-- =========================================================
-- 2. CREATE_MENU_VERSION
-- =========================================================
--
-- Crea una nueva versión para un menú existente, calculando
-- version_number = MAX(version_number) + 1 para ese menú, junto
-- con su composición, en una única transacción.
--
-- Mismas validaciones que create_menu, más:
--   - el menú p_menu_id debe existir.
--
-- Nota sobre concurrencia: igual que createDishVersion en
-- dish-versions.service.ts, existe una race condition teórica si
-- dos llamadas concurrentes calculan el mismo MAX+1 para el mismo
-- menú. El UNIQUE (menu_id, version_number) evita corrupción (la
-- segunda falla), no la previene.
-- =========================================================

create or replace function public.create_menu_version(
  p_menu_id uuid,
  p_name text,
  p_price numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_menu_version_id uuid;
  v_next_version_number integer;
  v_item_count integer;
  v_distinct_dish_version_count integer;
  v_main_count integer := 0;
  v_item jsonb;
  v_dish_version_id uuid;
  v_role text;
begin
  if not private.is_admin() then
    raise exception
      'Solo administradores pueden crear versiones de menú';
  end if;

  if not exists (
    select 1 from public.menus m where m.id = p_menu_id
  ) then
    raise exception
      'El menú % no existe',
      p_menu_id;
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception
      'El nombre de la versión no puede estar vacío';
  end if;

  if p_price is null or p_price < 0 then
    raise exception
      'El precio debe ser mayor o igual a 0';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception
      'p_items debe ser un array jsonb';
  end if;

  select
    count(*),
    count(distinct elem ->> 'dish_version_id')
  into
    v_item_count,
    v_distinct_dish_version_count
  from jsonb_array_elements(p_items) as elem;

  if v_item_count = 0 then
    raise exception
      'La versión debe tener al menos un ítem (el plato principal)';
  end if;

  if v_distinct_dish_version_count <> v_item_count then
    raise exception
      'No se puede repetir el mismo dish_version_id dentro de la versión';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if not jsonb_exists(v_item, 'dish_version_id')
       or not jsonb_exists(v_item, 'role') then
      raise exception
        'Cada ítem debe tener dish_version_id y role';
    end if;

    begin
      v_dish_version_id := (v_item ->> 'dish_version_id')::uuid;
    exception when others then
      raise exception
        'dish_version_id inválido: %',
        v_item ->> 'dish_version_id';
    end;

    v_role := v_item ->> 'role';

    if v_role not in ('main', 'side') then
      raise exception
        'role debe ser "main" o "side", recibido: %',
        v_role;
    end if;

    if not exists (
      select 1 from public.dish_versions dv
      where dv.id = v_dish_version_id
    ) then
      raise exception
        'dish_version_id % no existe',
        v_dish_version_id;
    end if;

    if v_role = 'main' then
      v_main_count := v_main_count + 1;
    end if;
  end loop;

  if v_main_count <> 1 then
    raise exception
      'La versión debe tener exactamente 1 ítem con role=main. Recibidos: %',
      v_main_count;
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_next_version_number
  from public.menu_versions
  where menu_id = p_menu_id;

  insert into public.menu_versions (
    menu_id,
    version_number,
    name,
    price
  )
  values (
    p_menu_id,
    v_next_version_number,
    btrim(p_name),
    p_price
  )
  returning id into v_menu_version_id;

  insert into public.menu_version_items (
    menu_version_id,
    dish_version_id,
    role
  )
  select
    v_menu_version_id,
    (elem ->> 'dish_version_id')::uuid,
    elem ->> 'role'
  from jsonb_array_elements(p_items) as elem;

  return v_menu_version_id;
end;
$$;
