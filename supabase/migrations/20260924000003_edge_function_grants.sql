-- =========================================================
-- Todo Artesanal v2 — Fase 5C
-- 20260924000003_edge_function_grants.sql
--
-- Responsabilidad:
--   - Otorgar a service_role los permisos necesarios para
--     que la Edge Function rotate-client-token pueda:
--       1. Verificar si el caller es admin (SELECT sobre
--          private.admin_users).
--       2. Operar sobre client_tokens con BYPASSRLS (ya lo
--          tiene por ser service_role, pero necesita los
--          grants de tabla, que ya están en 03_rls.sql).
--
-- Contexto:
--   03_rls.sql revocó todo sobre private.admin_users de public
--   y authenticated. service_role nunca tuvo grants sobre el
--   schema private. Sin estos grants, supabase.schema("private")
--   .from("admin_users") falla con permission denied.
--
-- No es una migración de seguridad del proyecto: service_role
-- es la clave que Supabase inyecta solo en Edge Functions y
-- jamás se expone al frontend. Este grant no relaja RLS para
-- los roles normales.
--
-- Orden de aplicación: después de 20260924000002_week_rpc.sql.
-- =========================================================

grant usage on schema private to service_role;
grant select on table private.admin_users to service_role;