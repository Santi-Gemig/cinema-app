export interface Pelicula {
  id: number;
  titulo: string;
  sinopsis: string;
  duracion_minutos: number;
  imagen_url: string;
  clasificacion_edad: 'ATP' | '+13' | '+18';
  generos: string[];
  formatos: string[];
  idiomas: string[];
  en_cartelera: boolean;
  es_estreno: boolean;
  fecha_estreno?: string;
  precio_preventa?: number;
  precio_normal: number;
  promedio_calificacion?: number;
  cantidad_reseñas?: number;
  created_at?: string;
}

export interface Reseña {
  id?: number;
  pelicula_id: number;
  usuario_id?: string;
  nombre_usuario: string;
  calificacion: number; // 1 a 5 estrellas
  comentario: string;
  created_at?: string;
}
