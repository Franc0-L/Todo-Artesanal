truncate table pedidos, dias_menu, semanas cascade;

-- 2) Catálogo de platos
create table platos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text,
  clima text not null default 'cualquiera' check (clima in ('frio', 'templado', 'calor', 'cualquiera')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table platos enable row level security;
create policy "admin_full_access_platos" on platos for all to authenticated using ((select private.es_admin())) with check ((select private.es_admin()));
revoke all on platos from anon;
grant select, insert, update, delete on platos to authenticated;

-- 3) dias_menu: texto libre -> referencia a platos
alter table dias_menu
  drop column plato_general,
  drop column plato_opcional;

alter table dias_menu
  add column plato_general_id uuid not null references platos(id),
  add column plato_opcional_id uuid not null references platos(id);

-- 4) Días fijos a lunes-viernes
alter table dias_menu drop constraint if exists dias_menu_dia_semana_check;
alter table dias_menu add constraint dias_menu_dia_semana_check
  check (dia_semana in ('lunes', 'martes', 'miercoles', 'jueves', 'viernes'));

-- Vista de apoyo: hace cuánto no se usa cada plato (catálogo + futura generación asistida)
create or replace view vista_uso_platos with (security_invoker = true) as
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

revoke all on vista_uso_platos from public, anon;
grant select on vista_uso_platos to authenticated;

-- 5) Funciones que dependían del texto libre

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
    pg.nombre,
    po.nombre,
    dm.notas_temperatura,
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
  p_dias jsonb -- [{dia_semana, fecha, plato_general_id, plato_opcional_id, notas_temperatura}, ...]
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
    insert into public.dias_menu (semana_id, dia_semana, fecha, plato_general_id, plato_opcional_id, notas_temperatura)
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
