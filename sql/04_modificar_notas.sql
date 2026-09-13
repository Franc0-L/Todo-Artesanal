alter table dias_menu drop column if exists notas_temperatura;

drop function if exists get_client_menu(text);

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
    (
      select p.tipo_menu
      from public.pedidos p
      where p.cliente_id = c.id and p.dia_menu_id = dm.id
    ) as eleccion_actual
  from public.clientes c
  join public.semanas s on s.activa = true
  join public.dias_menu dm on dm.semana_id = s.id
  join public.platos pg on pg.id = dm.plato_general_id
  join public.platos po on po.id = dm.plato_opcional_id
  where c.token = p_token and c.activo = true
  order by dm.fecha;
$$;

revoke all on function get_client_menu(text) from public;
grant execute on function get_client_menu(text) to anon;

create or replace function crear_semana(
  p_fecha_inicio date,
  p_precio_general numeric,
  p_precio_opcional numeric,
  p_dias jsonb -- [{dia_semana, fecha, plato_general_id, plato_opcional_id}, ...]
)
returns uuid
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_semana_id uuid;
  v_dia jsonb;
begin
  if not (select private.es_admin()) then
    raise exception 'No autorizado';
  end if;

  if p_dias is null or jsonb_array_length(p_dias) = 0 then
    raise exception 'La semana necesita al menos un día cargado';
  end if;

  update public.semanas set activa = false where activa = true;

  insert into public.semanas (fecha_inicio, precio_general, precio_opcional, activa)
  values (p_fecha_inicio, p_precio_general, p_precio_opcional, true)
  returning id into v_semana_id;

  for v_dia in select * from jsonb_array_elements(p_dias)
  loop
    insert into public.dias_menu (semana_id, dia_semana, fecha, plato_general_id, plato_opcional_id)
    values (
      v_semana_id,
      v_dia ->> 'dia_semana',
      (v_dia ->> 'fecha')::date,
      (v_dia ->> 'plato_general_id')::uuid,
      (v_dia ->> 'plato_opcional_id')::uuid
    );
  end loop;

  return v_semana_id;
end;
$$;

revoke all on function crear_semana(date, numeric, numeric, jsonb) from public;
grant execute on function crear_semana(date, numeric, numeric, jsonb) to authenticated;
