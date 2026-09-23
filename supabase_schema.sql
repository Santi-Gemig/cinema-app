-- =====================================================
-- SCHEMA COMPLETO PARA CINEMA-APP (SUPABASE POSTGRESQL)
-- Proyecto: Sistema Integral de Cine (Programación IV)
-- =====================================================

-- 1. EXTENSIÓN PARA UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA: USUARIOS (Perfiles asociados a Supabase Auth)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  tipo_sangre TEXT,
  color_ojos TEXT,
  dias_vacaciones INT DEFAULT 0,
  rol TEXT CHECK (rol IN ('cliente', 'empleado', 'admin')) DEFAULT 'cliente',
  puntos INT DEFAULT 0,
  credito NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: SALAS (20 filas A-T, 3 bloques de 4, 20 y 4 butacas)
CREATE TABLE IF NOT EXISTS public.salas (
  id SERIAL PRIMARY KEY,
  numero INT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  capacidad INT DEFAULT 532, -- 18 filas normales * 28 + 2 filas accesibles * 14
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: PELÍCULAS
CREATE TABLE IF NOT EXISTS public.peliculas (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  sinopsis TEXT NOT NULL,
  duracion_minutos INT NOT NULL,
  imagen_url TEXT NOT NULL,
  clasificacion_edad TEXT CHECK (clasificacion_edad IN ('ATP', '+13', '+18')) DEFAULT 'ATP',
  generos TEXT[] NOT NULL DEFAULT '{}',
  formatos TEXT[] DEFAULT '{"2D"}',
  idiomas TEXT[] DEFAULT '{"Castellano"}',
  en_cartelera BOOLEAN DEFAULT TRUE,
  es_estreno BOOLEAN DEFAULT FALSE,
  fecha_estreno DATE,
  precio_preventa NUMERIC(10, 2),
  precio_normal NUMERIC(10, 2) DEFAULT 5000.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA: FUNCIONES
CREATE TABLE IF NOT EXISTS public.funciones (
  id SERIAL PRIMARY KEY,
  pelicula_id INT NOT NULL REFERENCES public.peliculas(id) ON DELETE CASCADE,
  sala_id INT NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  fecha_hora TIMESTAMPTZ NOT NULL,
  fecha_hora_fin TIMESTAMPTZ NOT NULL, -- fecha_hora + duracion + 30 min de margen
  formato TEXT DEFAULT '2D',
  idioma TEXT DEFAULT 'Castellano',
  precio_base NUMERIC(10, 2) NOT NULL DEFAULT 5000.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA: CUPONES DE DESCUENTO
CREATE TABLE IF NOT EXISTS public.cupones (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  descripcion TEXT,
  porcentaje_descuento NUMERIC(5, 2) NOT NULL,
  solo_mayores_50 BOOLEAN DEFAULT FALSE,
  primera_compra BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA: PRODUCTOS DE CANDY BAR
CREATE TABLE IF NOT EXISTS public.productos_candy (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT CHECK (categoria IN ('pochoclos', 'bebidas', 'golosinas', 'combos')) NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10, 2) NOT NULL,
  puntos_canje INT DEFAULT 150,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLA: COMBOS ESPECIALES (Entrada + Pochoclos + Bebida a precio fijo)
CREATE TABLE IF NOT EXISTS public.combos_especiales (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  precio NUMERIC(10, 2) NOT NULL,
  incluye_entrada BOOLEAN DEFAULT TRUE,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABLA: COMPRAS
CREATE TABLE IF NOT EXISTS public.compras (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_contacto TEXT NOT NULL,
  nombre_contacto TEXT NOT NULL,
  total NUMERIC(12, 2) NOT NULL,
  descuento_aplicado NUMERIC(12, 2) DEFAULT 0.00,
  cupon_codigo TEXT REFERENCES public.cupones(codigo),
  credito_usado NUMERIC(12, 2) DEFAULT 0.00,
  metodo_pago TEXT NOT NULL DEFAULT 'Tarjeta',
  qr_codigo TEXT UNIQUE NOT NULL,
  qr_usado_cine BOOLEAN DEFAULT FALSE,
  qr_usado_candy BOOLEAN DEFAULT FALSE,
  qr_cine_validado_at TIMESTAMPTZ,
  qr_candy_validado_at TIMESTAMPTZ,
  qr_validado_por UUID REFERENCES auth.users(id),
  estado TEXT CHECK (estado IN ('completada', 'cancelada')) DEFAULT 'completada',
  puntos_ganados INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABLA: ENTRADAS (Butacas compradas/ocupadas por función)
CREATE TABLE IF NOT EXISTS public.entradas (
  id SERIAL PRIMARY KEY,
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  funcion_id INT NOT NULL REFERENCES public.funciones(id) ON DELETE CASCADE,
  fila TEXT NOT NULL, -- A hasta T
  numero INT NOT NULL, -- 1 hasta 28
  tipo TEXT CHECK (tipo IN ('comun', 'discapacidad', 'vip')) DEFAULT 'comun',
  precio NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(funcion_id, fila, numero)
);

-- 11. TABLA: ITEMS DE CANDY POR COMPRA
CREATE TABLE IF NOT EXISTS public.compras_candy_items (
  id SERIAL PRIMARY KEY,
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  producto_id INT REFERENCES public.productos_candy(id),
  combo_id INT REFERENCES public.combos_especiales(id),
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(10, 2) NOT NULL
);

-- 12. TABLA: RESEÑAS DE PELÍCULAS
CREATE TABLE IF NOT EXISTS public.reseñas (
  id SERIAL PRIMARY KEY,
  pelicula_id INT NOT NULL REFERENCES public.peliculas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre_usuario TEXT NOT NULL,
  calificacion INT CHECK (calificacion BETWEEN 1 AND 5) NOT NULL,
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. TABLA: HISTORIAL DE CANJES DE PUNTOS
CREATE TABLE IF NOT EXISTS public.canjes_puntos (
  id SERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puntos_usados INT NOT NULL,
  recompensa_tipo TEXT NOT NULL,
  recompensa_detalle TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. TABLA: AUDITORÍA
CREATE TABLE IF NOT EXISTS public.auditoria (
  id SERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES auth.users(id),
  usuario_email TEXT,
  accion TEXT NOT NULL,
  detalles JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- HABILITACIÓN DE REALTIME PARA BUTACAS (ENTRADAS)
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.entradas;

-- =====================================================
-- HABILITACIÓN DE RLS (ROW LEVEL SECURITY)
-- =====================================================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peliculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_candy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos_especiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_candy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseñas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canjes_puntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública (cualquier visitante puede ver cartelera, salas, candy)
CREATE POLICY "Lectura publica de salas" ON public.salas FOR SELECT USING (true);
CREATE POLICY "Lectura publica de peliculas" ON public.peliculas FOR SELECT USING (true);
CREATE POLICY "Lectura publica de funciones" ON public.funciones FOR SELECT USING (true);
CREATE POLICY "Lectura publica de productos candy" ON public.productos_candy FOR SELECT USING (true);
CREATE POLICY "Lectura publica de combos" ON public.combos_especiales FOR SELECT USING (true);
CREATE POLICY "Lectura publica de reseñas" ON public.reseñas FOR SELECT USING (true);
CREATE POLICY "Lectura publica de cupones" ON public.cupones FOR SELECT USING (true);
CREATE POLICY "Lectura publica de entradas para ver butacas ocupadas" ON public.entradas FOR SELECT USING (true);

-- Políticas de Usuarios
CREATE POLICY "Usuarios pueden ver su propio perfil" ON public.usuarios FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.usuarios FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Permitir insercion de perfil propio al registrarse" ON public.usuarios FOR INSERT WITH CHECK (true);

-- Políticas de Compras
CREATE POLICY "Permitir compras anonimas y registradas" ON public.compras FOR INSERT WITH CHECK (true);
CREATE POLICY "Usuarios ven sus compras o compras publicas por id" ON public.compras FOR SELECT USING (auth.uid() = usuario_id OR usuario_id IS NULL);
CREATE POLICY "Permitir insercion de entradas" ON public.entradas FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir insercion de candy items" ON public.compras_candy_items FOR INSERT WITH CHECK (true);

-- Políticas de Reseñas y Auditoría
CREATE POLICY "Usuarios autenticados pueden crear reseñas" ON public.reseñas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir insercion en auditoria" ON public.auditoria FOR INSERT WITH CHECK (true);
CREATE POLICY "Lectura de auditoria" ON public.auditoria FOR SELECT USING (true);

-- =====================================================
-- DATOS SEMILLA (INICIALES) PARA ARRANCAR
-- =====================================================
INSERT INTO public.salas (numero, nombre, capacidad) VALUES
  (1, 'Sala 1 - IMAX Laser', 532),
  (2, 'Sala 2 - Dolby Atmos 4K', 532),
  (3, 'Sala 3 - 4D E-Motion', 532),
  (4, 'Sala 4 - Standard', 532)
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.cupones (codigo, descripcion, porcentaje_descuento, solo_mayores_50, primera_compra, activo) VALUES
  ('BIENVENIDA20', 'Descuento del 20% en tu primera compra', 20.00, false, true, true),
  ('MAYORES50', 'Descuento especial del 30% para mayores de 50 años', 30.00, true, false, true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.productos_candy (nombre, categoria, descripcion, precio, puntos_canje, imagen_url, activo) VALUES
  ('Pochoclos Grandes', 'pochoclos', 'Balde gigante de pochoclos dulces o salados recién hechos', 3500.00, 150, 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=500', true),
  ('Pochoclos Medianos', 'pochoclos', 'Balde mediano de pochoclos', 2800.00, 120, 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=500', true),
  ('Gaseosa Grande 750ml', 'bebidas', 'Línea Coca-Cola, Sprite o Fanta', 2200.00, 90, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500', true),
  ('Nachos con Queso Cheddar', 'golosinas', 'Porción de nachos crocantes con salsa cheddar caliente', 3200.00, 140, 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=500', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.combos_especiales (nombre, descripcion, precio, incluye_entrada, imagen_url, activo) VALUES
  ('Mega Combo Cine', '1 Entrada General + 1 Balde de Pochoclos Grande + 1 Gaseosa 750ml', 8900.00, true, 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500', true),
  ('Combo Pareja', '2 Entradas Generales + 1 Balde Gigante + 2 Gaseosas', 16500.00, true, 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.peliculas (titulo, sinopsis, duracion_minutos, imagen_url, clasificacion_edad, generos, formatos, idiomas, en_cartelera, es_estreno, precio_preventa, precio_normal) VALUES
  ('Dune: Parte 2', 'Paul Atreides se une a Chani y a los Fremen mientras busca venganza contra los conspiradores que destruyeron a su familia.', 166, 'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg', '+13', '{"Ciencia Ficción", "Aventura"}', '{"2D", "3D"}', '{"Subtitulada", "Castellano"}', true, false, 4500.00, 5500.00),
  ('Intensa-Mente 2', 'Regresa a la mente de la recién graduada Riley mientras el cuartel general sufre una repentina demolición.', 96, 'https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg', 'ATP', '{"Animación", "Comedia", "Familiar"}', '{"2D", "3D"}', '{"Castellano"}', true, false, 4000.00, 5000.00),
  ('Deadpool & Wolverine', 'Wade Wilson se une al icónico Wolverine en una misión multiversal épica y desenfrenada.', 128, 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg', '+18', '{"Acción", "Comedia", "Ciencia Ficción"}', '{"2D", "3D", "4D"}', '{"Subtitulada", "Castellano"}', true, false, 4800.00, 6000.00),
  ('Gladiador 2', 'Años después de presenciar la muerte del venerado héroe Máximo a manos de su tío, Lucio debe entrar en el Coliseo.', 148, 'https://image.tmdb.org/t/p/w500/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg', '+18', '{"Acción", "Aventura", "Drama"}', '{"2D"}', '{"Subtitulada"}', false, true, 5200.00, 6500.00)
ON CONFLICT DO NOTHING;

-- =====================================================
-- CLASE 7: SUPABASE STORAGE (BUCKET "productos" Y POLÍTICAS)
-- =====================================================

-- 1. Crear el Bucket "productos" público si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('productos', 'productos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Política que permite hacer INSERT en el bucket Productos
CREATE POLICY "Permitir subir archivos a productos"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'productos'
);

-- 3. Política que permite hacer SELECT en el bucket Productos
CREATE POLICY "Permitir ver archivos de productos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'productos'
);

-- 4. Política que permite hacer DELETE en el bucket Productos
CREATE POLICY "Permitir borrar archivos de productos"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (
  bucket_id = 'productos'
);

-- 5. TABLA: PRODUCTOS (Modelo de la Clase 7)
CREATE TABLE IF NOT EXISTS public.productos (
  id INT8 GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL,
  precio NUMERIC(10, 2) NOT NULL,
  imagen_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura publica de productos clase 7"
ON public.productos FOR SELECT
USING (true);

CREATE POLICY "Permitir insercion y gestion de productos clase 7"
ON public.productos FOR ALL
TO anon, authenticated
USING (true) WITH CHECK (true);

