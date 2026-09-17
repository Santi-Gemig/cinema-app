-- =====================================================
-- PATCH HITO 4: POLÍTICAS DE ADMINISTRACIÓN Y REALTIME
-- =====================================================

-- 1. Políticas RLS para Administración de Películas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin insertar peliculas') THEN
    CREATE POLICY "Admin insertar peliculas" ON public.peliculas FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin actualizar peliculas') THEN
    CREATE POLICY "Admin actualizar peliculas" ON public.peliculas FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin borrar peliculas') THEN
    CREATE POLICY "Admin borrar peliculas" ON public.peliculas FOR DELETE USING (true);
  END IF;
END $$;

-- 2. Políticas RLS para Administración de Cupones
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin insertar cupones') THEN
    CREATE POLICY "Admin insertar cupones" ON public.cupones FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin actualizar cupones') THEN
    CREATE POLICY "Admin actualizar cupones" ON public.cupones FOR UPDATE USING (true);
  END IF;
END $$;

-- 3. Políticas RLS para Candy Bar y Combos
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin insertar candy') THEN
    CREATE POLICY "Admin insertar candy" ON public.productos_candy FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin actualizar candy') THEN
    CREATE POLICY "Admin actualizar candy" ON public.productos_candy FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin insertar combos') THEN
    CREATE POLICY "Admin insertar combos" ON public.combos_especiales FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin actualizar combos') THEN
    CREATE POLICY "Admin actualizar combos" ON public.combos_especiales FOR UPDATE USING (true);
  END IF;
END $$;

-- 4. Políticas para Cancelación de Compras y Liberación de Butacas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir actualizacion de compras') THEN
    CREATE POLICY "Permitir actualizacion de compras" ON public.compras FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir borrado de entradas al cancelar') THEN
    CREATE POLICY "Permitir borrado de entradas al cancelar" ON public.entradas FOR DELETE USING (true);
  END IF;
END $$;

-- 5. Habilitar Realtime para Auditoría
ALTER PUBLICATION supabase_realtime ADD TABLE public.auditoria;

