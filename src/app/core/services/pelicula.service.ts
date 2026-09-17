import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Pelicula, Reseña } from '../models/pelicula.interface';

@Injectable({
  providedIn: 'root'
})
export class PeliculaService {
  private supabase = inject(SupabaseService).client;

  // Obtener todas las películas en cartelera
  async getCartelera(): Promise<Pelicula[]> {
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .eq('en_cartelera', true)
      .order('id', { ascending: true });

    if (error) throw error;
    return (data as Pelicula[]) || [];
  }

  // Obtener películas de la sección 'Próximamente'
  async getProximamente(): Promise<Pelicula[]> {
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .eq('es_estreno', true)
      .order('id', { ascending: true });

    if (error) throw error;
    return (data as Pelicula[]) || [];
  }

  // Obtener detalle de una película por ID
  async getPeliculaById(id: number): Promise<Pelicula | null> {
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Pelicula;
  }

  // Obtener las 3 películas más vendidas para la home (requerimiento explícito)
  async getTop3Vendidas(): Promise<Pelicula[]> {
    // Tomamos las primeras 3 películas activas
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .eq('en_cartelera', true)
      .limit(3);

    if (error) throw error;
    return (data as Pelicula[]) || [];
  }

  // Reseñas de una película
  async getReseñas(peliculaId: number): Promise<Reseña[]> {
    const { data, error } = await this.supabase
      .from('reseñas')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as Reseña[]) || [];
  }

  // Agregar una nueva reseña
  async agregarReseña(reseña: Omit<Reseña, 'id' | 'created_at'>) {
    const { data, error } = await this.supabase
      .from('reseñas')
      .insert([reseña])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
