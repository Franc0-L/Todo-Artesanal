-- =========================================================
-- Todo Artesanal v2 — Fase 5C
-- 20260924000004_admin_check_rpc.sql
--
-- Responsabilidad:
--   - Exponer un RPC público para que la Edge Function
--     rotate-client-token pueda verificar si un usuario es
--     admin, sin acceder al schema private.
--
-- Contexto:
--   PostgREST solo expone por defecto el schema public.
--   Acceder a private.admin_users desde una Edge Function
--   vía supabase-js no funciona porque PostgREST responde
--   404/406.
--
--   Esta función pública resuelve el problema: internamente
--   consulta private.admin_users con security definer.
--
-- Seguridad:
--   - security definer: accede a private.admin_users.
--   - Recibe p_user_id como parámetro.
--   - No expone datos: devuelve solo un boolean.
--   - Revocada de PUBLIC y authenticated. Solo service_role
--     la puede invocar.
-- =========================================================

create or replace function public.is_user_admin(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from private.admin_users
    where user_id = p_user_id
  );
$$;

revoke all on function public.is_user_admin(uuid) from public;
revoke all on function public.is_user_admin(uuid) from authenticated;
grant execute on function public.is_user_admin(uuid) to service_role;