-- Extend mdr_datasets to link to a client
ALTER TABLE public.mdr_datasets
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notas text;

CREATE INDEX IF NOT EXISTS idx_mdr_datasets_cliente ON public.mdr_datasets(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mdr_datasets_user_fechas ON public.mdr_datasets(user_id, fecha_desde, fecha_hasta);

-- Accounting movements (ingresos / egresos)
CREATE TABLE IF NOT EXISTS public.movimientos_contables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  categoria text,
  descripcion text NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'COP',
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  factura_id uuid REFERENCES public.facturas(id) ON DELETE SET NULL,
  soporte_path text,
  soporte_mime text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimientos_contables TO authenticated;
GRANT ALL ON public.movimientos_contables TO service_role;

ALTER TABLE public.movimientos_contables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own movimientos" ON public.movimientos_contables
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_movimientos_updated_at
  BEFORE UPDATE ON public.movimientos_contables
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_movimientos_user_fecha ON public.movimientos_contables(user_id, fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_cliente ON public.movimientos_contables(cliente_id);
