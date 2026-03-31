-- ============================================================
-- Eliminar CHECK constraints hardcodeados de talleres
-- para que los valores sean gestionados dinámicamente por el LOV
-- ============================================================

ALTER TABLE public.talleres
  DROP CONSTRAINT IF EXISTS talleres_tipo_pago_check,
  DROP CONSTRAINT IF EXISTS talleres_modalidad_check;
