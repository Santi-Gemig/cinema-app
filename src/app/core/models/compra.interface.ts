export interface EntradaComprada {
  id?: number;
  compra_id?: string;
  funcion_id: number;
  fila: string;
  numero: number;
  tipo: 'comun' | 'discapacidad' | 'vip';
  precio: number;
}

export interface CompraItemCandy {
  id?: number;
  producto_id?: number;
  combo_id?: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export interface Compra {
  id: string;
  usuario_id?: string;
  email_contacto: string;
  nombre_contacto: string;
  total: number;
  descuento_aplicado: number;
  cupon_codigo?: string;
  credito_usado: number;
  metodo_pago: string;
  qr_codigo: string;
  qr_usado_cine: boolean;
  qr_usado_candy: boolean;
  qr_cine_validado_at?: string;
  qr_candy_validado_at?: string;
  estado: 'completada' | 'cancelada';
  puntos_ganados: number;
  created_at: string;
  entradas?: any[];
  candy_items?: CompraItemCandy[];
  compras_candy_items?: any[];
}
