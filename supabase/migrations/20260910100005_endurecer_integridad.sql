do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_precio_general_especial_nonnegative' and conrelid = 'public.clientes'::regclass) then
    alter table public.clientes add constraint clientes_precio_general_especial_nonnegative check (precio_general_especial is null or precio_general_especial >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clientes_precio_opcional_especial_nonnegative' and conrelid = 'public.clientes'::regclass) then
    alter table public.clientes add constraint clientes_precio_opcional_especial_nonnegative check (precio_opcional_especial is null or precio_opcional_especial >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'semanas_precio_general_nonnegative' and conrelid = 'public.semanas'::regclass) then
    alter table public.semanas add constraint semanas_precio_general_nonnegative check (precio_general >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'semanas_precio_opcional_nonnegative' and conrelid = 'public.semanas'::regclass) then
    alter table public.semanas add constraint semanas_precio_opcional_nonnegative check (precio_opcional >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dias_menu_platos_distintos' and conrelid = 'public.dias_menu'::regclass) then
    alter table public.dias_menu add constraint dias_menu_platos_distintos check (plato_general_id <> plato_opcional_id);
  end if;
end $$;

create unique index if not exists uq_dias_menu_semana_fecha
  on public.dias_menu (semana_id, fecha);

create index if not exists idx_dias_menu_semana_fecha
  on public.dias_menu (semana_id, fecha);

create index if not exists idx_pedidos_dia_menu
  on public.pedidos (dia_menu_id);

create index if not exists idx_pedidos_cliente
  on public.pedidos (cliente_id);

create index if not exists idx_clientes_activo
  on public.clientes (activo);

create index if not exists idx_platos_activo_nombre
  on public.platos (activo, nombre);

create unique index if not exists uq_platos_nombre_normalizado
  on public.platos (lower(trim(nombre)));

create or replace function public.set_actualizado_en()
returns trigger
security invoker
set search_path = ''
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trg_pedidos_actualizado on public.pedidos;

create trigger trg_pedidos_actualizado
before update on public.pedidos
for each row
execute function public.set_actualizado_en();

drop function if exists public.get_client_menu(text);

create or replace function public.get_client_menu(p_token text)
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
  select c.nombre, s.fecha_inicio, dm.id, dm.dia_semana, dm.fecha,
         pg.nombre, pg.clima, po.nombre, po.clima,
         (select p.tipo_menu from public.pedidos p
          where p.cliente_id = c.id and p.dia_menu_id = dm.id)
  from public.clientes c
  join public.semanas s on s.activa = true
  join public.dias_menu dm on dm.semana_id = s.id
  join public.platos pg on pg.id = dm.plato_general_id and pg.activo = true
  join public.platos po on po.id = dm.plato_opcional_id and po.activo = true
  where c.token = p_token and c.activo = true
  order by dm.fecha;
$$;

revoke all on function public.get_client_menu(text) from public;
grant execute on function public.get_client_menu(text) to anon;

drop function if exists public.crear_semana(date, numeric, numeric, jsonb);

create or replace function public.crear_semana(
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
  v_fecha date;
  v_dia_semana text;
  v_general uuid;
  v_opcional uuid;
  v_cantidad integer;
begin
  if not (select private.es_admin()) then
    raise exception 'No autorizado';
  end if;

  if p_fecha_inicio is null or extract(isodow from p_fecha_inicio) <> 1 then
    raise exception 'La fecha de inicio debe ser un lunes';
  end if;

  if p_precio_general is null or p_precio_general < 0 then
    raise exception 'El precio general no puede ser negativo';
  end if;

  if p_precio_opcional is null or p_precio_opcional < 0 then
    raise exception 'El precio opcional no puede ser negativo';
  end if;

  if p_dias is null or jsonb_typeof(p_dias) <> 'array' or jsonb_array_length(p_dias) <> 5 then
    raise exception 'La semana debe tener exactamente 5 días';
  end if;

  for v_dia in select * from jsonb_array_elements(p_dias)
  loop
    v_fecha := (v_dia ->> 'fecha')::date;
    v_dia_semana := v_dia ->> 'dia_semana';
    v_general := (v_dia ->> 'plato_general_id')::uuid;
    v_opcional := (v_dia ->> 'plato_opcional_id')::uuid;

    if v_dia_semana not in ('lunes', 'martes', 'miercoles', 'jueves', 'viernes') then
      raise exception 'Día de menú inválido: %', v_dia_semana;
    end if;

    if v_fecha <> p_fecha_inicio + case v_dia_semana
      when 'lunes' then 0 when 'martes' then 1 when 'miercoles' then 2
      when 'jueves' then 3 when 'viernes' then 4 end then
      raise exception 'La fecha no coincide con el día de la semana: %', v_dia_semana;
    end if;

    if v_general is null or v_opcional is null then
      raise exception 'Cada día necesita plato general y opcional';
    end if;

    if v_general = v_opcional then
      raise exception 'El plato general y el opcional deben ser distintos';
    end if;

    select count(*) into v_cantidad
    from public.platos
    where id in (v_general, v_opcional) and activo = true;

    if v_cantidad <> 2 then
      raise exception 'Todos los platos seleccionados deben existir y estar activos';
    end if;
  end loop;

  if (select count(distinct value ->> 'dia_semana')
      from jsonb_array_elements(p_dias) as value) <> 5 then
    raise exception 'No puede haber días de semana repetidos';
  end if;

  update public.semanas set activa = false where activa = true;

  insert into public.semanas (fecha_inicio, precio_general, precio_opcional, activa)
  values (p_fecha_inicio, p_precio_general, p_precio_opcional, true)
  returning id into v_semana_id;

  for v_dia in select * from jsonb_array_elements(p_dias)
  loop
    insert into public.dias_menu
      (semana_id, dia_semana, fecha, plato_general_id, plato_opcional_id)
    values
      (v_semana_id, v_dia ->> 'dia_semana', (v_dia ->> 'fecha')::date,
       (v_dia ->> 'plato_general_id')::uuid, (v_dia ->> 'plato_opcional_id')::uuid);
  end loop;

  return v_semana_id;
end;
$$;

revoke all on function public.crear_semana(date, numeric, numeric, jsonb) from public;
grant execute on function public.crear_semana(date, numeric, numeric, jsonb) to authenticated;
