-- ============================================================
-- Todo Artesanal - comprobaciones manuales de seguridad
-- ============================================================
-- Ejecutar en Supabase SQL Editor con una sesión/rol acorde a cada caso.
-- No modifica datos.

-- 1) RLS habilitado en tablas expuestas.
select
  c.relname as tabla,
  c.relrowsecurity as rls_habilitado,
  c.relforcerowsecurity as rls_forzado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('clientes','semanas','dias_menu','pedidos','platos')
order by c.relname;

-- Esperado: rls_habilitado = true en las 5 tablas.

-- 2) Permisos de tablas.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('clientes','semanas','dias_menu','pedidos','platos')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;

-- Esperado:
-- anon: sin permisos directos sobre tablas.
-- authenticated: SELECT/INSERT/UPDATE/DELETE, pero RLS limita el acceso a admins.

-- 3) Funciones sensibles: solo los roles necesarios deben ejecutarlas.
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('get_client_menu','crear_semana','submit_order')
  and grantee in ('anon','authenticated','public')
order by routine_name, grantee;

-- Esperado:
-- get_client_menu(text): anon.
-- crear_semana(date,numeric,numeric,jsonb): authenticated.
-- submit_order(...): anon (si está instalado en la base actual).
-- No debería existir EXECUTE concedido explícitamente a PUBLIC.

-- 4) Índices de FK que suelen advertirse en Supabase Advisor.
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_dias_menu_plato_general',
    'idx_dias_menu_plato_opcional',
    'idx_dias_menu_semana_fecha',
    'idx_pedidos_dia_menu',
    'idx_pedidos_cliente'
  )
order by indexname;

-- 5) Comprobación de una única semana activa.
select count(*) as semanas_activas
from public.semanas
where activa = true;

-- Esperado: 0 o 1.

-- 6) Comprobación de duplicados normalizados de platos.
select lower(trim(nombre)) as nombre_normalizado, count(*)
from public.platos
group by lower(trim(nombre))
having count(*) > 1;

-- Esperado: 0 filas.
