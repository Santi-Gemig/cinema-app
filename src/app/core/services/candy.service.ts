import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ProductoCandy, ComboEspecial } from '../models/candy.interface';

@Injectable({
  providedIn: 'root'
})
export class CandyService {
  private supabase = inject(SupabaseService).client;

  // Obtener productos individuales de Candy Bar
  async getProductos(): Promise<ProductoCandy[]> {
    const { data, error } = await this.supabase
      .from('productos_candy')
      .select('*')
      .eq('activo', true)
      .order('id', { ascending: true });

    if (error) throw error;
    return (data as ProductoCandy[]) || [];
  }

  // Obtener combos especiales configurados por el admin
  async getCombos(): Promise<ComboEspecial[]> {
    const { data, error } = await this.supabase
      .from('combos_especiales')
      .select('*')
      .eq('activo', true)
      .order('id', { ascending: true });

    if (error) throw error;
    return (data as ComboEspecial[]) || [];
  }
}
