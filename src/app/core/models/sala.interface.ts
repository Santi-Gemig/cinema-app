export interface Sala {
  id: number;
  numero: number;
  nombre: string;
  capacidad: number;
  created_at?: string;
}

export type TipoButaca = 'comun' | 'discapacidad' | 'vip';

export interface Butaca {
  fila: string; // 'A' .. 'T'
  numero: number;
  tipo: TipoButaca;
  ocupada?: boolean;
  seleccionada?: boolean;
  precio: number;
}
