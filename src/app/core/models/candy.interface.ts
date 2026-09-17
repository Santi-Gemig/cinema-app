export type CategoriaCandy = 'pochoclos' | 'bebidas' | 'golosinas' | 'combos';

export interface ProductoCandy {
  id: number;
  nombre: string;
  categoria: CategoriaCandy;
  descripcion: string;
  precio: number;
  puntos_canje: number;
  imagen_url?: string;
  activo: boolean;
  cantidad?: number;
}

export interface ComboEspecial {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  incluye_entrada: boolean;
  imagen_url?: string;
  activo: boolean;
  cantidad?: number;
}
