-- Rollback de 20260926000002_add_week_offer_modality.sql
-- Ejecutar solamente si se desea revertir este bloque completo.
-- Verificar antes que no haya pedidos que dependan de la nueva semántica.

DROP INDEX IF EXISTS public.week_day_options_week_day_offer_modality_unique;
ALTER TABLE public.week_day_options
  DROP CONSTRAINT IF EXISTS week_day_options_offer_modality_check;
ALTER TABLE public.week_day_options
  DROP COLUMN IF EXISTS offer_modality;

-- Restaurar las funciones de dominio desde la migración previa:
-- 20260923000002_functions.sql
-- y volver a aplicar cualquier migración posterior que haya reemplazado
-- validate_order/activate_week.
