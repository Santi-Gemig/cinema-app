export type UserRole = 'cliente' | 'empleado' | 'admin';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  tipo_sangre: string;
  color_ojos: string;
  dias_vacaciones: number;
  rol: UserRole;
  puntos: number;
  credito: number;
  created_at?: string;
}
