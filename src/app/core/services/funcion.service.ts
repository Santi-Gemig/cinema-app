import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Funcion } from '../models/funcion.interface';
import { Butaca, TipoButaca } from '../models/sala.interface';
import { EntradaComprada } from '../models/compra.interface';

export interface FilaButacas {
  letra: string;
  esDiscapacidad: boolean;
  esVip: boolean;
  bloqueIzquierdo: Butaca[];
  bloqueCentro: Butaca[];
  bloqueDerecho: Butaca[];
}

@Injectable({
  providedIn: 'root'
})
export class FuncionService {
  private supabase = inject(SupabaseService).client;

  // Obtener funciones disponibles para una película
  async getFuncionesPorPelicula(peliculaId: number): Promise<Funcion[]> {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('*, sala:salas(*)')
      .eq('pelicula_id', peliculaId)
      .order('fecha_hora', { ascending: true });

    if (error) throw error;
    return (data as Funcion[]) || [];
  }

  // Obtener función específica por ID
  async getFuncionById(id: number): Promise<Funcion | null> {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('*, sala:salas(*), pelicula:peliculas(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Funcion;
  }

  // Obtener las butacas ya ocupadas/compradas para una función específica
  async getButacasOcupadas(funcionId: number): Promise<EntradaComprada[]> {
    const { data, error } = await this.supabase
      .from('entradas')
      .select('*')
      .eq('funcion_id', funcionId);

    if (error) throw error;
    return (data as EntradaComprada[]) || [];
  }

  // Suscribirse a cambios en tiempo real (Supabase Realtime)
  suscribirCambiosButacas(funcionId: number, onOcupada: (entrada: EntradaComprada) => void) {
    const canal = this.supabase
      .channel(`entradas_funcion_${funcionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'entradas',
          filter: `funcion_id=eq.${funcionId}`
        },
        (payload) => {
          onOcupada(payload.new as EntradaComprada);
        }
      )
      .subscribe();

    return canal;
  }

  // Generador de la sala física inmutable (Regla del TP):
  // 20 filas (A a T), 3 columnas de 4, 20 y 4 butacas.
  // Filas J y K adaptadas para discapacidad (2, 10 y 2).
  // Filas R, S y T asignadas a VIP (precio superior).
  generarMapaFisico(ocupadas: EntradaComprada[], precioBase: number): FilaButacas[] {
    const filasLetras = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];
    const mapa: FilaButacas[] = [];

    // Conjunto para búsqueda rápida de ocupadas
    const ocupadasSet = new Set(ocupadas.map(o => `${o.fila}-${o.numero}`));

    for (const letra of filasLetras) {
      const esDiscapacidad = letra === 'J' || letra === 'K';
      const esVip = letra === 'R' || letra === 'S' || letra === 'T';

      let tipo: TipoButaca = 'comun';
      let precio = precioBase;

      if (esDiscapacidad) {
        tipo = 'discapacidad';
      } else if (esVip) {
        tipo = 'vip';
        precio = precioBase + 1500; // Recargo VIP
      }

      // Distribución de asientos por fila
      const bloqueIzq: Butaca[] = [];
      const bloqueCent: Butaca[] = [];
      const bloqueDer: Butaca[] = [];

      if (esDiscapacidad) {
        // Formato accesible: 2, 10 y 2
        for (let i = 1; i <= 2; i++) {
          bloqueIzq.push({ fila: letra, numero: i, tipo, precio, ocupada: ocupadasSet.has(`${letra}-${i}`) });
        }
        for (let i = 3; i <= 12; i++) {
          bloqueCent.push({ fila: letra, numero: i, tipo, precio, ocupada: ocupadasSet.has(`${letra}-${i}`) });
        }
        for (let i = 13; i <= 14; i++) {
          bloqueDer.push({ fila: letra, numero: i, tipo, precio, ocupada: ocupadasSet.has(`${letra}-${i}`) });
        }
      } else {
        // Formato estándar y VIP: 4, 20 y 4
        for (let i = 1; i <= 4; i++) {
          bloqueIzq.push({ fila: letra, numero: i, tipo, precio, ocupada: ocupadasSet.has(`${letra}-${i}`) });
        }
        for (let i = 5; i <= 24; i++) {
          bloqueCent.push({ fila: letra, numero: i, tipo, precio, ocupada: ocupadasSet.has(`${letra}-${i}`) });
        }
        for (let i = 25; i <= 28; i++) {
          bloqueDer.push({ fila: letra, numero: i, tipo, precio, ocupada: ocupadasSet.has(`${letra}-${i}`) });
        }
      }

      mapa.push({
        letra,
        esDiscapacidad,
        esVip,
        bloqueIzquierdo: bloqueIzq,
        bloqueCentro: bloqueCent,
        bloqueDerecho: bloqueDer
      });
    }

    return mapa;
  }
}
