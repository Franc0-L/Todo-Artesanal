-- Todo Artesanal - 0007 - RPCs de reportes (montos consolidados, solo admin).
--
-- Los montos salen SIEMPRE de orders.applied_price (precio congelado en el
-- pedido): el reporte agrega, nunca recalcula precio. Ver
-- docs/adr/003-precio-congelado-en-pedido.md.
--
-- Devuelve una sola fila jsonb: evita el limite de max_rows de PostgREST y
-- resuelve el reporte en un unico round-trip.


CREATE FUNCTION public.get_week_report(p_week_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $$
declare
  v_week public.weeks%rowtype;
  v_expected_count integer;
  v_responding_count integer;
begin
  -- -------------------------------------------------------
  -- Frontera de seguridad: lo decide la DB, no el frontend.
  -- El rol `authenticated` tambien lo tienen los clientes (JWT ES256),
  -- pero `private.is_admin()` exige un auth.uid() en private.admin_users.
  -- -------------------------------------------------------
  if not private.is_admin() then
    raise exception
      'Solo administradores pueden consultar reportes';
  end if;

  select * into v_week
  from public.weeks
  where id = p_week_id;

  if not found then
    raise exception
      'La semana % no existe',
      p_week_id;
  end if;

  -- -------------------------------------------------------
  -- "Sin responder" se computa contra week_expected_clients (la
  -- poblacion congelada al activar la semana), nunca contra
  -- clients.active. Ver docs/adr/005-semana-no-pertenece-a-cliente.md.
  -- -------------------------------------------------------
  select count(*) into v_expected_count
  from public.week_expected_clients
  where week_id = p_week_id;

  select count(*) into v_responding_count
  from public.week_expected_clients wec
  where wec.week_id = p_week_id
    and (
      exists (
        select 1
        from public.orders o
        join public.week_days wd on wd.id = o.week_day_id
        where wd.week_id = p_week_id
          and o.client_id = wec.client_id
      )
      or exists (
        select 1
        from public.cancellations c
        join public.week_days wd on wd.id = c.week_day_id
        where wd.week_id = p_week_id
          and c.client_id = wec.client_id
      )
    );

  return jsonb_build_object(
    'week_id', v_week.id,
    'start_date', v_week.start_date,
    'end_date', v_week.end_date,
    'status', v_week.status,

    -- -------------------------------------------------------
    -- Totales de la semana.
    -- -------------------------------------------------------
    'totals', jsonb_build_object(
      'order_count', (
        select count(*)
        from public.orders o
        join public.week_days wd on wd.id = o.week_day_id
        where wd.week_id = p_week_id
      ),
      'total_quantity', coalesce((
        select sum(o.quantity)
        from public.orders o
        join public.week_days wd on wd.id = o.week_day_id
        where wd.week_id = p_week_id
      ), 0),
      'total_amount', coalesce((
        select round(sum(o.quantity * o.applied_price), 2)
        from public.orders o
        join public.week_days wd on wd.id = o.week_day_id
        where wd.week_id = p_week_id
      ), 0),
      'cancellation_count', (
        select count(*)
        from public.cancellations c
        join public.week_days wd on wd.id = c.week_day_id
        where wd.week_id = p_week_id
      ),
      'expected_client_count', v_expected_count,
      'responding_client_count', v_responding_count,
      'unanswered_client_count', v_expected_count - v_responding_count
    ),

    -- -------------------------------------------------------
    -- Por dia: incluye los 5 dias de la semana, incluso sin pedidos.
    -- -------------------------------------------------------
    'by_day', coalesce((
      select jsonb_agg(d.day_report order by (d.day_report ->> 'day_of_week')::int)
      from (
        select jsonb_build_object(
          'week_day_id', wd.id,
          'date', wd.date,
          'day_of_week', wd.day_of_week,
          'order_count', (
            select count(*) from public.orders o where o.week_day_id = wd.id
          ),
          'quantity', coalesce((
            select sum(o.quantity) from public.orders o where o.week_day_id = wd.id
          ), 0),
          'amount', coalesce((
            select round(sum(o.quantity * o.applied_price), 2)
            from public.orders o
            where o.week_day_id = wd.id
          ), 0),
          'cancellation_count', (
            select count(*) from public.cancellations c where c.week_day_id = wd.id
          ),
          'unanswered_count', (
            select count(*)
            from public.week_expected_clients wec
            where wec.week_id = p_week_id
              and not exists (
                select 1 from public.orders o
                where o.week_day_id = wd.id and o.client_id = wec.client_id
              )
              and not exists (
                select 1 from public.cancellations c
                where c.week_day_id = wd.id and c.client_id = wec.client_id
              )
          )
        ) as day_report
        from public.week_days wd
        where wd.week_id = p_week_id
      ) d
    ), '[]'::jsonb),

    -- -------------------------------------------------------
    -- Por modalidad de pedido.
    -- -------------------------------------------------------
    'by_modality', coalesce((
      select jsonb_agg(jsonb_build_object(
        'modality', m.modality,
        'order_count', m.order_count,
        'quantity', m.quantity,
        'amount', m.amount
      ) order by array_position(array['general', 'opcional', 'media_vianda'], m.modality))
      from (
        select
          o.modality,
          count(*) as order_count,
          sum(o.quantity) as quantity,
          round(sum(o.quantity * o.applied_price), 2) as amount
        from public.orders o
        join public.week_days wd on wd.id = o.week_day_id
        where wd.week_id = p_week_id
        group by o.modality
      ) m
    ), '[]'::jsonb),

    -- -------------------------------------------------------
    -- Por producto: la opcion de oferta del dia o el item de catalogo
    -- (media vianda). `source` distingue el origen del pedido.
    -- -------------------------------------------------------
    'by_product', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', p.source,
        'option_type', p.option_type,
        'name', p.name,
        'modality', p.modality,
        'order_count', p.order_count,
        'quantity', p.quantity,
        'amount', p.amount
      ) order by p.amount desc, p.name)
      from (
        select
          case
            when o.week_day_option_id is not null then 'option'
            when o.dish_version_id is not null then 'dish'
            else 'menu'
          end as source,
          wdo.option_type,
          coalesce(odv.name, omv.name, dv.name, mv.name, 'Sin nombre') as name,
          o.modality,
          count(*) as order_count,
          sum(o.quantity) as quantity,
          round(sum(o.quantity * o.applied_price), 2) as amount
        from public.orders o
        join public.week_days wd on wd.id = o.week_day_id
        left join public.week_day_options wdo on wdo.id = o.week_day_option_id
        left join public.dish_versions odv on odv.id = wdo.dish_version_id
        left join public.menu_versions omv on omv.id = wdo.menu_version_id
        left join public.dish_versions dv on dv.id = o.dish_version_id
        left join public.menu_versions mv on mv.id = o.menu_version_id
        where wd.week_id = p_week_id
        group by 1, 2, 3, 4
      ) p
    ), '[]'::jsonb),

    -- -------------------------------------------------------
    -- Por cliente: solo quienes tienen pedidos en la semana.
    -- -------------------------------------------------------
    'by_client', coalesce((
      select jsonb_agg(jsonb_build_object(
        'client_id', c.client_id,
        'name', c.name,
        'order_count', c.order_count,
        'quantity', c.quantity,
        'amount', c.amount
      ) order by c.name)
      from (
        select
          o.client_id,
          cl.name,
          count(*) as order_count,
          sum(o.quantity) as quantity,
          round(sum(o.quantity * o.applied_price), 2) as amount
        from public.orders o
        join public.week_days wd on wd.id = o.week_day_id
        join public.clients cl on cl.id = o.client_id
        where wd.week_id = p_week_id
        group by o.client_id, cl.name
      ) c
    ), '[]'::jsonb),

    -- -------------------------------------------------------
    -- Detalle de los esperados que no respondieron.
    -- -------------------------------------------------------
    'unanswered', coalesce((
      select jsonb_agg(jsonb_build_object(
        'client_id', wec.client_id,
        'name', cl.name
      ) order by cl.name)
      from public.week_expected_clients wec
      join public.clients cl on cl.id = wec.client_id
      where wec.week_id = p_week_id
        and not exists (
          select 1
          from public.orders o
          join public.week_days wd on wd.id = o.week_day_id
          where wd.week_id = p_week_id and o.client_id = wec.client_id
        )
        and not exists (
          select 1
          from public.cancellations c
          join public.week_days wd on wd.id = c.week_day_id
          where wd.week_id = p_week_id and c.client_id = wec.client_id
        )
    ), '[]'::jsonb)
  );
end;
$$;




revoke all on function public.get_week_report(uuid) from public;
grant execute on function public.get_week_report(uuid) to authenticated;
grant execute on function public.get_week_report(uuid) to service_role;
