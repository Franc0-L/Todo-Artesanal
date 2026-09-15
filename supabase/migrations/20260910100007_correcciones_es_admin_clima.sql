-- Todo Artesanal — correcciones 07
-- Corré esto después de 06_security_submit_order.sql.

-- 1) El grant que faltaba desde el principio: sin esto, cualquier política RLS
--    o función que llama a private.es_admin() falla con
--    "permission denied for function es_admin". Es seguro correrlo aunque ya
--    lo hayas aplicado a mano antes (es idempotente).
grant execute on function private.es_admin() to authenticated;

-- 2) get_client_menu: se saca el filtro "activo = true" de los platos.
--    "Activo" sirve para ocultar un plato al armar semanas NUEVAS (ver Platos.jsx),
--    no para esconder retroactivamente un día que un cliente ya puede estar viendo
--    en la semana activa. Con el filtro puesto, desactivar un plato usado en la
--    semana actual hacía desaparecer el día entero de la pantalla del cliente.
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
  join public.platos pg on pg.id = dm.plato_general_id
  join public.platos po on po.id = dm.plato_opcional_id
  where c.token = p_token and c.activo = true
  order by dm.fecha;
$$;

revoke all on function public.get_client_menu(text) from public;
grant execute on function public.get_client_menu(text) to anon;
