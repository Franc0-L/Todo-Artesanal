create or replace function crear_semana(
  p_fecha_inicio date,
  p_precio_general numeric,
  p_precio_opcional numeric,
  p_dias jsonb -- [{dia_semana, fecha, plato_general, plato_opcional, notas_temperatura}, ...]
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
    insert into public.dias_menu (semana_id, dia_semana, fecha, plato_general, plato_opcional, notas_temperatura)
    values (
      v_semana_id,
      v_dia ->> 'dia_semana',
      (v_dia ->> 'fecha')::date,
      v_dia ->> 'plato_general',
      v_dia ->> 'plato_opcional',
      nullif(v_dia ->> 'notas_temperatura', '')
    );
  end loop;

  return v_semana_id;
end;
$$;

revoke all on function crear_semana(date, numeric, numeric, jsonb) from public;
grant execute on function crear_semana(date, numeric, numeric, jsonb) to authenticated;
