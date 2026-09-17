import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Compra, EntradaComprada, CompraItemCandy } from '../models/compra.interface';
import { jsPDF } from 'jspdf';
import * as QRCode from 'qrcode';

@Injectable({
  providedIn: 'root'
})
export class CompraService {
  private supabase = inject(SupabaseService).client;
  private authService = inject(AuthService);

  // Generar código alfanumérico único para el QR y validación manual
  generarCodigoQR(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'CIN-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Validar cupón de descuento en Supabase
  async validarCupon(codigo: string, usuarioEdad?: number): Promise<{ porcentaje: number; error?: string }> {
    const { data, error } = await this.supabase
      .from('cupones')
      .select('*')
      .eq('codigo', codigo.trim().toUpperCase())
      .eq('activo', true)
      .single();

    if (error || !data) {
      return { porcentaje: 0, error: 'Cupón no válido o inactivo' };
    }

    if (data.solo_mayores_50 && (usuarioEdad === undefined || usuarioEdad < 50)) {
      return { porcentaje: 0, error: 'Este cupón es exclusivo para personas mayores de 50 años' };
    }

    return { porcentaje: data.porcentaje_descuento };
  }

  // Procesar la compra completa en Supabase
  async procesarCompra(params: {
    nombre: string;
    email: string;
    entradas: { funcion_id: number; fila: string; numero: number; tipo: 'comun' | 'discapacidad' | 'vip'; precio: number }[];
    candyItems: { producto_id?: number; combo_id?: number; nombre: string; cantidad: number; precio_unitario: number }[];
    total: number;
    descuento: number;
    cuponCodigo?: string;
    creditoUsado: number;
    metodoPago: string;
  }): Promise<Compra> {
    const user = this.authService.currentUser();
    const qrCodigo = this.generarCodigoQR();
    const puntosGanados = Math.floor(params.total); // 1 punto por cada $1 ARS gastado

    // 1. Insertar compra principal
    const { data: compra, error: errorCompra } = await this.supabase
      .from('compras')
      .insert({
        usuario_id: user ? user.id : null,
        nombre_contacto: params.nombre,
        email_contacto: params.email,
        total: params.total,
        descuento_aplicado: params.descuento,
        cupon_codigo: params.cuponCodigo || null,
        credito_usado: params.creditoUsado,
        metodo_pago: params.metodoPago,
        qr_codigo: qrCodigo,
        estado: 'completada',
        puntos_ganados: puntosGanados
      })
      .select()
      .single();

    if (errorCompra) throw errorCompra;

    // 2. Insertar entradas (butacas)
    if (params.entradas.length > 0) {
      const entradasData = params.entradas.map(e => ({
        compra_id: compra.id,
        funcion_id: e.funcion_id,
        fila: e.fila,
        numero: e.numero,
        tipo: e.tipo,
        precio: e.precio
      }));

      const { error: errorEntradas } = await this.supabase
        .from('entradas')
        .insert(entradasData);

      if (errorEntradas) throw errorEntradas;
    }

    // 3. Insertar items de Candy Bar
    if (params.candyItems.length > 0) {
      const candyData = params.candyItems.map(c => ({
        compra_id: compra.id,
        producto_id: c.producto_id || null,
        combo_id: c.combo_id || null,
        cantidad: c.cantidad,
        precio_unitario: c.precio_unitario
      }));

      const { error: errorCandy } = await this.supabase
        .from('compras_candy_items')
        .insert(candyData);

      if (errorCandy) throw errorCandy;
    }

    // 4. Si el usuario está registrado, acreditar puntos y descontar crédito usado
    if (user) {
      const userData = this.authService.currentUserData();
      if (userData) {
        const nuevosPuntos = (userData.puntos || 0) + puntosGanados;
        const nuevoCredito = Math.max(0, (userData.credito || 0) - params.creditoUsado);

        await this.supabase
          .from('usuarios')
          .update({ puntos: nuevosPuntos, credito: nuevoCredito })
          .eq('id', user.id);

        await this.authService.loadUserData(user.id);
      }
    }

    return compra as Compra;
  }

  // Generar y descargar el PDF con QR Dinámico
  async generarEntradaPDF(datos: {
    peliculaTitulo: string;
    salaNombre: string;
    fechaHora: string;
    formato: string;
    idioma: string;
    comprador: string;
    qrCodigo: string;
    butacas: { fila: string; numero: number; tipo: string }[];
    candyItems: { nombre: string; cantidad: number }[];
    total: number;
  }) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5' // Formato entrada de cine elegante
    });

    // Fondo oscuro de cine
    doc.setFillColor(18, 22, 31);
    doc.rect(0, 0, 148, 210, 'F');

    // Borde decorativo
    doc.setDrawColor(229, 9, 20);
    doc.setLineWidth(1.5);
    doc.roundedRect(6, 6, 136, 198, 4, 4);

    // Cabecera
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CINEMA APP', 74, 20, { align: 'center' });

    doc.setTextColor(245, 197, 24);
    doc.setFontSize(9);
    doc.text('ENTRADA OFICIAL DIGITAL', 74, 26, { align: 'center' });

    // Línea separadora
    doc.setDrawColor(42, 46, 61);
    doc.setLineWidth(0.5);
    doc.line(12, 32, 136, 32);

    // Datos de la Película
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(datos.peliculaTitulo, 74, 42, { align: 'center' });

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${datos.salaNombre} • ${datos.formato} • ${datos.idioma}`, 74, 48, { align: 'center' });
    doc.text(`Fecha y Hora: ${datos.fechaHora}`, 74, 54, { align: 'center' });

    // Butacas
    doc.setDrawColor(42, 46, 61);
    doc.line(12, 60, 136, 60);

    doc.setTextColor(245, 197, 24);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('BUTACAS RESERVADAS:', 14, 68);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const butacasStr = datos.butacas.map(b => `${b.fila}-${b.numero} (${b.tipo.toUpperCase()})`).join(', ');
    doc.text(butacasStr, 14, 75, { maxWidth: 120 });

    // Candy Bar si incluye
    let yPos = 86;
    if (datos.candyItems.length > 0) {
      doc.setTextColor(245, 197, 24);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('CANDY BAR INCLUIDO:', 14, yPos);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      yPos += 6;
      datos.candyItems.forEach(item => {
        doc.text(`• ${item.cantidad}x ${item.nombre}`, 14, yPos);
        yPos += 5;
      });
      yPos += 4;
    }

    // Generar código QR dinámico
    const qrDataUrl = await QRCode.toDataURL(datos.qrCodigo, {
      width: 256,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });

    // Marco blanco para el QR
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(49, yPos, 50, 50, 2, 2, 'F');
    doc.addImage(qrDataUrl, 'PNG', 51, yPos + 2, 46, 46);

    // Código legible abajo del QR
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(datos.qrCodigo, 74, yPos + 58, { align: 'center' });

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Presenta este código en la entrada de la sala y en el Candy Bar.', 74, yPos + 64, { align: 'center' });
    doc.text('Válido por un solo uso para cada sector.', 74, yPos + 68, { align: 'center' });

    // Pie con total y comprador
    doc.setDrawColor(42, 46, 61);
    doc.line(12, 192, 136, 192);

    doc.setTextColor(245, 197, 24);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL PAGADO: $${datos.total}`, 14, 198);

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Titular: ${datos.comprador}`, 134, 198, { align: 'right' });

    // Descargar
    doc.save(`Entrada_CinemaApp_${datos.qrCodigo}.pdf`);
  }

  // Obtener historial completo de compras de un usuario para "Mis Películas"
  async getComprasUsuario(usuarioId: string): Promise<Compra[]> {
    const { data, error } = await this.supabase
      .from('compras')
      .select(`
        *,
        entradas:entradas(
          *,
          funcion:funciones(
            *,
            pelicula:peliculas(*),
            sala:salas(*)
          )
        ),
        compras_candy_items(
          *,
          producto:productos_candy(*),
          combo:combos_especiales(*)
        )
      `)
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener compras del usuario:', error);
      return [];
    }
    return (data as Compra[]) || [];
  }

  // Cancelar compra hasta 2 horas antes de la función (Requerimiento explícito)
  async cancelarCompra(compraId: string, funcionFechaHora: string): Promise<{ success: boolean; error?: string }> {
    const funcionTime = new Date(funcionFechaHora).getTime();
    const now = Date.now();
    const dosHorasEnMs = 2 * 60 * 60 * 1000;

    if (funcionTime - now < dosHorasEnMs) {
      return { success: false, error: 'Las cancelaciones solo se permiten hasta 2 horas antes del inicio de la función.' };
    }

    // 1. Obtener la compra
    const { data: compra, error } = await this.supabase
      .from('compras')
      .select('*')
      .eq('id', compraId)
      .single();

    if (error || !compra) return { success: false, error: 'Compra no encontrada' };

    // 2. Marcar como cancelada y liberar butacas
    await this.supabase
      .from('compras')
      .update({ estado: 'cancelada' })
      .eq('id', compraId);

    await this.supabase
      .from('entradas')
      .delete()
      .eq('compra_id', compraId);

    // 3. Devolver el dinero como CRÉDITO en la cuenta (no efectivo) y registrar auditoría
    if (compra.usuario_id) {
      const userData = this.authService.currentUserData();
      const creditoActual = Number(userData?.credito || 0);
      const puntosActuales = Number(userData?.puntos || 0);
      const nuevoCredito = creditoActual + Number(compra.total);
      const nuevosPuntos = Math.max(0, puntosActuales - Number(compra.puntos_ganados || 0));

      await this.supabase
        .from('usuarios')
        .update({ credito: nuevoCredito, puntos: nuevosPuntos })
        .eq('id', compra.usuario_id);

      // Registrar auditoría de la cancelación
      await this.supabase.from('auditoria').insert({
        usuario_id: compra.usuario_id,
        usuario_email: compra.email_contacto,
        accion: 'CANCELAR_COMPRA',
        detalles: {
          compra_id: compraId,
          total_reembolsado: compra.total,
          credito_asignado: nuevoCredito,
          motivo: 'Cancelación solicitada con más de 2 horas de anticipación'
        }
      });

      await this.authService.loadUserData(compra.usuario_id);
    }

    return { success: true };
  }

  // Validar código QR (desde el módulo de empleados)
  async validarCodigo(codigo: string) {
    const { data, error } = await this.supabase
      .from('compras')
      .select('*, entradas(*), compras_candy_items(*, producto:productos_candy(*), combo:combos_especiales(*))')
      .eq('qr_codigo', codigo.trim().toUpperCase())
      .single();

    if (error || !data) {
      return { data: null, error: 'Código QR no encontrado en el sistema.' };
    }

    return { data: data as Compra, error: null };
  }

  // Marcar sector como validado (cine o candy)
  async marcarValidado(compraId: string, sector: 'cine' | 'candy') {
    const user = this.authService.currentUser();
    const updateData: any = {};

    if (sector === 'cine') {
      updateData.qr_usado_cine = true;
      updateData.qr_cine_validado_at = new Date().toISOString();
    } else {
      updateData.qr_usado_candy = true;
      updateData.qr_candy_validado_at = new Date().toISOString();
    }
    updateData.qr_validado_por = user ? user.id : null;

    const { data, error } = await this.supabase
      .from('compras')
      .update(updateData)
      .eq('id', compraId)
      .select()
      .single();

    // Registrar en auditoría
    await this.supabase.from('auditoria').insert({
      usuario_id: user ? user.id : null,
      usuario_email: user?.email || 'Empleado',
      accion: `VALIDAR_QR_${sector.toUpperCase()}`,
      detalles: { compra_id: compraId, timestamp: new Date().toISOString() }
    });

    return { data, error };
  }
}
