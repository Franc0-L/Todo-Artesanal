drop function if exists public.submit_order(text, uuid, text);

create or replace function public.submit_order(
  p_token text,
  p_dia_menu_id uuid,
  p_tipo text
)
returns void
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_cliente_id uuid;
  v_semana_id uuid;
  v_dia_menu_id uuid;
begin
  if p_tipo not in ('general', 'opcional', 'no_come') then
    raise exception 'Tipo de menú inválido';
  end if;

  select c.id
    into v_cliente_id
  from public.clientes c
  where c.token = p_token
    and c.activo = true;

  if v_cliente_id is null then
    raise exception 'Cliente no encontrado';
  end if;

  select dm.id, dm.semana_id
    into v_dia_menu_id, v_semana_id
  from public.dias_menu dm
  join public.semanas s on s.id = dm.semana_id
  where dm.id = p_dia_menu_id
    and s.activa = true;

  if v_dia_menu_id is null then
    raise exception 'Día de menú no disponible';
  end if;

  perform 1
  from public.semanas s
  where s.id = v_semana_id
    and s.activa = true
  for update;

  if not found then
    raise exception 'La semana ya no está disponible';
  end if;

  insert into public.pedidos (
    cliente_id,
    dia_menu_id,
    tipo_menu
  )
  values (
    v_cliente_id,
    v_dia_menu_id,
    p_tipo
  )
  on conflict (cliente_id, dia_menu_id)
  do update
    set tipo_menu = excluded.tipo_menu,
        actualizado_en = now();
end;
$$;

revoke all on function public.submit_order(text, uuid, text) from public;
grant execute on function public.submit_order(text, uuid, text) to anon;
