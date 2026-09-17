import { Pelicula } from './pelicula.interface';
import { Sala } from './sala.interface';

export interface Funcion {
  id: number;
  pelicula_id: number;
  sala_id: number;
  fecha_hora: string;
  fecha_hora_fin: string;
  formato: string;
  idioma: string;
  precio_base: number;
  created_at?: string;
  pelicula?: Pelicula;
  sala?: Sala;
}
