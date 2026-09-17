import { Injectable, signal, computed, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { User, Session } from '@supabase/supabase-js';
import { Usuario, UserRole } from '../models/usuario.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase = inject(SupabaseService).client;

  // Signals para el estado de autenticación (reactividad moderna de Angular)
  currentUser = signal<User | null>(null);
  currentSession = signal<Session | null>(null);
  currentUserData = signal<Usuario | null>(null);

  // Computeds convenientes para consultar rol y estado
  isLoggedIn = computed(() => !!this.currentUser());
  rol = computed<UserRole | null>(() => this.currentUserData()?.rol ?? null);
  isAdmin = computed(() => this.currentUserData()?.rol === 'admin');
  isEmpleado = computed(() => this.currentUserData()?.rol === 'empleado' || this.currentUserData()?.rol === 'admin');

  constructor() {
    this.initAuthSession();
  }

  private async initAuthSession() {
    // 1. Obtener la sesión activa al arrancar la app
    const { data: { session } } = await this.supabase.auth.getSession();
    this.currentSession.set(session);
    this.currentUser.set(session?.user ?? null);
    if (session?.user) {
      await this.loadUserData(session.user.id);
    }

    // 2. Escuchar cambios de autenticación en tiempo real (login, logout, token refresh)
    this.supabase.auth.onAuthStateChange(async (_event, session) => {
      this.currentSession.set(session);
      this.currentUser.set(session?.user ?? null);
      if (session?.user) {
        await this.loadUserData(session.user.id);
      } else {
        this.currentUserData.set(null);
      }
    });
  }

  async loadUserData(userId: string) {
    const { data, error } = await this.supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      this.currentUserData.set(data as Usuario);
    }
  }

  async login(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  async register(
    email: string,
    password: string,
    perfil: Omit<Usuario, 'id' | 'email' | 'rol' | 'puntos' | 'credito' | 'created_at'>
  ) {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Verificar si el email ya existe en la tabla de usuarios
    const { data: existente } = await this.supabase
      .from('usuarios')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existente) {
      return {
        data: null,
        error: { message: 'Este correo electrónico ya se encuentra registrado. Por favor inicia sesión.' }
      };
    }

    // 2. Registrar usuario en Auth de Supabase
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: cleanEmail,
      password
    });

    if (authError) {
      let msg = authError.message;
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already in use')) {
        msg = 'Este correo electrónico ya se encuentra registrado. Por favor inicia sesión.';
      }
      return { data: authData, error: { message: msg } };
    }

    if (!authData.user || (authData.user.identities && authData.user.identities.length === 0)) {
      return {
        data: authData,
        error: { message: 'Este correo electrónico ya se encuentra registrado. Por favor inicia sesión.' }
      };
    }

    // 3. Insertar perfil en la tabla pública 'usuarios'
    const nuevoUsuario: Partial<Usuario> = {
      id: authData.user.id,
      email: cleanEmail,
      nombre: perfil.nombre,
      apellido: perfil.apellido,
      fecha_nacimiento: perfil.fecha_nacimiento,
      tipo_sangre: perfil.tipo_sangre,
      color_ojos: perfil.color_ojos,
      dias_vacaciones: perfil.dias_vacaciones,
      rol: 'cliente',
      puntos: 0,
      credito: 0
    };

    const { error: profileError } = await this.supabase
      .from('usuarios')
      .insert(nuevoUsuario);

    if (profileError) {
      let msg = profileError.message;
      if (
        profileError.code === '23505' ||
        msg.includes('duplicate key') ||
        msg.includes('usuarios_pkey') ||
        msg.includes('usuarios_email')
      ) {
        msg = 'Este correo electrónico ya se encuentra registrado. Por favor inicia sesión.';
      }
      return { data: authData, error: { message: msg } };
    }

    return { data: authData, error: null };
  }

  async cambiarRol(nuevoRol: UserRole) {
    const user = this.currentUser();
    if (user) {
      await this.supabase.from('usuarios').update({ rol: nuevoRol }).eq('id', user.id);
      await this.loadUserData(user.id);
    } else {
      const curr = this.currentUserData();
      if (curr) {
        this.currentUserData.set({ ...curr, rol: nuevoRol });
      }
    }
  }

  async logout() {
    const { error } = await this.supabase.auth.signOut();
    this.currentUser.set(null);
    this.currentSession.set(null);
    this.currentUserData.set(null);
    return { error };
  }
}
