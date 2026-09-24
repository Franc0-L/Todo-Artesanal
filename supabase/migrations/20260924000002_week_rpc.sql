-- =========================================================
-- Todo Artesanal v2 — Fase 5C
-- 20260924000002_week_rpc.sql
--
-- Responsabilidad:
--   - RPCs para crear una semana (identidad + 5 días) y para
--     actualizar sus fechas en estado draft, cada una en una
--     única transacción de PostgreSQL.
--
-- NO incluye:
--   - triggers (viven en 02_triggers.sql, no se tocan);
--   - RLS (vive en 03_rls.sql, no se toca);
--   - modificaciones a 01_functions.sql.
--
-- Contexto:
--   create_week: crear una semana requiere insertar la fila en
--   weeks Y sus 5 week_days. Si el segundo paso falla después
--   del primero, sin transacción quedaría una semana huérfana
--   sin días, inutilizable (activate_week exige exactamente 5).
--   Análogo a create_menu (ver 20260924000001_menu_rpc.sql).
--
--   update_week: cambiar fechas requiere borrar los week_days
--   actuales (cascadea week_day_options) e insertar 5 nuevos.
--   Se hace en una sola transacción para no dejar la semana con
--   menos de 5 días si algo falla a mitad.
--
-- Grants: sin revoke/grant explícito, igual que activate_week,
-- close_week, create_menu y create_menu_version. La única
-- barrera es is_admin().
--
-- Orden de aplicación: después de 20260924000001_menu_rpc.sql.
-- =========================================================


-- =========================================================
-- 1. CREATE_WEEK
-- =========================================================
--
-- Crea una semana en estado draft junto con sus 5 días
-- (lunes a viernes), en una única transacción.
--
-- Validaciones:
--   - ejecutor es admin;
--   - p_start_date y p_end_date no nulos;
--   - p_start_date <= p_end_date;
--   - p_start_date es lunes (isodow = 1);
--   - p_end_date es viernes (isodow = 5);
--   - el rango es de exactamente 5 días (end - start = 4).
--
-- El EXCLUDE gist weeks_no_overlap impide solapamiento con
-- semanas existentes. No se duplica esa validación acá: si hay
-- conflicto, la constraint lo rechaza con error claro (23P01,
-- mapeado a CONFLICT en error-handler.ts).
-- =========================================================

create or replace function public.create_week(
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_id uuid;
  v_day integer;
begin
  if not private.is_admin() then
    raise exception
      'Solo administradores pueden crear semanas';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception
      'Las fechas de inicio y fin son obligatorias';
  end if;

  if p_start_date > p_end_date then
    raise exception
      'La fecha de fin no puede ser anterior a la fecha de inicio';
  end if;

  if extract(isodow from p_start_date) <> 1 then
    raise exception
      'La semana debe comenzar un lunes';
  end if;

  if extract(isodow from p_end_date) <> 5 then
    raise exception
      'La semana debe terminar un viernes';
  end if;

  if (p_end_date - p_start_date) <> 4 then
    raise exception
      'La semana debe tener exactamente 5 días (lunes a viernes)';
  end if;

  insert into public.weeks (start_date, end_date, status)
  values (p_start_date, p_end_date, 'draft')
  returning id into v_week_id;

  for v_day in 1..5 loop
    insert into public.week_days (week_id, day_of_week, date)
    values (v_week_id, v_day, p_start_date + (v_day - 1));
  end loop;

  return v_week_id;
end;
$$;


-- =========================================================
-- 2. UPDATE_WEEK
-- =========================================================
--
-- Actualiza las fechas de una semana en estado draft.
--
-- ADVERTENCIA: si ya hay week_day_options cargadas en los días
-- actuales, esta operación las elimina (cascade de week_days
-- → week_day_options). El flujo esperado es configurar fechas
-- antes de cargar opciones de oferta.
--
-- TODO: evaluar un flag p_confirm_delete_options en el futuro
-- si el caso de uso lo requiere.
--
-- Validaciones:
--   - ejecutor es admin;
--   - la semana existe;
--   - la semana está en draft;
--   - mismas validaciones de fecha que create_week.
-- =========================================================

create or replace function public.update_week(
  p_week_id uuid,
  p_start_date date,
  p_end_date date
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_status text;
  v_day integer;
begin
  if not private.is_admin() then
    raise exception
      'Solo administradores pueden actualizar semanas';
  end if;

  select status
  into v_status
  from public.weeks
  where id = p_week_id;

  if not found then
    raise exception
      'La semana % no existe',
      p_week_id;
  end if;

  if v_status <> 'draft' then
    raise exception
      'Solo se pueden modificar semanas en estado draft. Estado actual: %',
      v_status;
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception
      'Las fechas de inicio y fin son obligatorias';
  end if;

  if p_start_date > p_end_date then
    raise exception
      'La fecha de fin no puede ser anterior a la fecha de inicio';
  end if;

  if extract(isodow from p_start_date) <> 1 then
    raise exception
      'La semana debe comenzar un lunes';
  end if;

  if extract(isodow from p_end_date) <> 5 then
    raise exception
      'La semana debe terminar un viernes';
  end if;

  if (p_end_date - p_start_date) <> 4 then
    raise exception
      'La semana debe tener exactamente 5 días (lunes a viernes)';
  end if;

  delete from public.week_days where week_id = p_week_id;

  for v_day in 1..5 loop
    insert into public.week_days (week_id, day_of_week, date)
    values (p_week_id, v_day, p_start_date + (v_day - 1));
  end loop;

  update public.weeks
  set
    start_date = p_start_date,
    end_date = p_end_date,
    updated_at = now()
  where id = p_week_id;
end;
$$;