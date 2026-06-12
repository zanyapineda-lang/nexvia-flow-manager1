
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  nombre TEXT,
  empresa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid()=id) WITH CHECK (auth.uid()=id);

-- clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  nit TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  ciudad TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clientes" ON public.clientes FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- facturas
CREATE TABLE public.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes ON DELETE SET NULL,
  numero TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  tipo TEXT NOT NULL DEFAULT 'factura', -- factura | proforma
  estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | pagada | anulada
  moneda TEXT NOT NULL DEFAULT 'COP',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  notas TEXT,
  cliente_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facturas TO authenticated;
GRANT ALL ON public.facturas TO service_role;
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own facturas" ON public.facturas FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- factura items
CREATE TABLE public.factura_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES public.facturas ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(14,4) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(14,4) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.factura_items TO authenticated;
GRANT ALL ON public.factura_items TO service_role;
ALTER TABLE public.factura_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own items" ON public.factura_items FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- soportes de pago
CREATE TABLE public.soportes_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  factura_id UUID REFERENCES public.facturas ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes ON DELETE SET NULL,
  nombre_archivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamano_bytes BIGINT,
  monto NUMERIC(14,2),
  fecha DATE DEFAULT CURRENT_DATE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soportes_pago TO authenticated;
GRANT ALL ON public.soportes_pago TO service_role;
ALTER TABLE public.soportes_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own soportes" ON public.soportes_pago FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- mdr datasets (resumen procesado)
CREATE TABLE public.mdr_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'MDR', -- MDR | CDR
  fecha_desde DATE,
  fecha_hasta DATE,
  total_registros BIGINT NOT NULL DEFAULT 0,
  total_out BIGINT NOT NULL DEFAULT 0,
  total_in BIGINT NOT NULL DEFAULT 0,
  total_delivered BIGINT NOT NULL DEFAULT 0,
  total_failed BIGINT NOT NULL DEFAULT 0,
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb, -- por operador, por dia, etc
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_datasets TO authenticated;
GRANT ALL ON public.mdr_datasets TO service_role;
ALTER TABLE public.mdr_datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mdr" ON public.mdr_datasets FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- cierres contables
CREATE TABLE public.cierres_contables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  periodo TEXT NOT NULL, -- YYYY-MM
  estado TEXT NOT NULL DEFAULT 'abierto', -- abierto | cerrado
  total_ingresos NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_egresos NUMERIC(14,2) NOT NULL DEFAULT 0,
  notas TEXT,
  archivos JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{nombre,path,mime,size}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cierres_contables TO authenticated;
GRANT ALL ON public.cierres_contables TO service_role;
ALTER TABLE public.cierres_contables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cierres" ON public.cierres_contables FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER tg_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_clientes_upd BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_facturas_upd BEFORE UPDATE ON public.facturas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_cierres_upd BEFORE UPDATE ON public.cierres_contables FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- profile autocreate
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
