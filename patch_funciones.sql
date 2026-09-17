-- Permitir gestión de funciones y peliculas para el panel y pruebas
CREATE POLICY "Permitir insercion de funciones" ON public.funciones FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualizacion de funciones" ON public.funciones FOR UPDATE USING (true);
CREATE POLICY "Permitir borrado de funciones" ON public.funciones FOR DELETE USING (true);

-- Insertar funciones de prueba para hoy y mañana
INSERT INTO public.funciones (pelicula_id, sala_id, fecha_hora, fecha_hora_fin, formato, idioma, precio_base) VALUES
  (1, 1, NOW() + INTERVAL '2 hours', NOW() + INTERVAL '5 hours', '3D Laser', 'Subtitulada', 5500.00),
  (1, 1, NOW() + INTERVAL '6 hours', NOW() + INTERVAL '9 hours', '2D Digital', 'Castellano', 5000.00),
  (2, 3, NOW() + INTERVAL '1 hour', NOW() + INTERVAL '3 hours', '3D Digital', 'Castellano', 5000.00),
  (3, 2, NOW() + INTERVAL '3 hours', NOW() + INTERVAL '5 hours 30 minutes', '4D E-Motion', 'Subtitulada', 6000.00);

-- Marcar un par de butacas de prueba como ocupadas para ver el tiempo real
-- (Se cargarán automáticamente cuando se creen compras)
