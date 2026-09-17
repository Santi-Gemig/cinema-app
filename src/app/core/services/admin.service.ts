import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Sala } from '../models/sala.interface';
import { Pelicula } from '../models/pelicula.interface';
import { Funcion } from '../models/funcion.interface';
import { ProductoCandy, ComboEspecial } from '../models/candy.interface';
import { jsPDF } from 'jspdf';

export interface ReporteFacturacion {
  totalFacturado: number;
  facturacionHoy: number;
  totalEntradasVendidas: number;
  totalCandyVendidos: number;
}

export interface PeliculaRanking {
  peliculaId: number;
  titulo: string;
  imagenUrl: string;
  entradasVendidas: number;
  totalRecaudado: number;
}

export interface CandyRanking {
  nombre: string;
  categoria: string;
  cantidadVendida: number;
  totalRecaudado: number;
}

export interface LogAuditoria {
  id: number;
  usuario_id: string | null;
  usuario_email: string | null;
  accion: string;
  detalles: any;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private supabase = inject(SupabaseService).client;
  private authService = inject(AuthService);

  // =====================================================
  // 1. MOTOR DE ASIGNACIÓN AUTOMÁTICA DE SALAS
  // Regla: No solapamientos + 30 min buffer de limpieza
  // =====================================================
  async asignarSalaAutomatica(
    fechaHoraInicio: string,
    duracionMinutos: number
  ): Promise<{ sala: Sala | null; fechaHoraFin: string; error?: string }> {
    const inicioMs = new Date(fechaHoraInicio).getTime();
    // La función ocupa: duración de la película + 30 minutos obligatorios de limpieza
    const duracionConBufferMin = duracionMinutos + 30;
    const finMs = inicioMs + duracionConBufferMin * 60 * 1000;
    const fechaHoraFinStr = new Date(finMs).toISOString();

    // 1. Obtener todas las salas del cine
    const { data: salas, error: errorSalas } = await this.supabase
      .from('salas')
      .select('*')
      .order('numero', { ascending: true });

    if (errorSalas || !salas || salas.length === 0) {
      return { sala: null, fechaHoraFin: fechaHoraFinStr, error: 'No se encontraron salas registradas.' };
    }

    // 2. Obtener todas las funciones programadas que puedan intersectar el día
    // Consideramos un rango amplio del mismo día para verificar solapamientos
    const diaInicio = new Date(inicioMs);
    diaInicio.setHours(0, 0, 0, 0);
    const diaFin = new Date(inicioMs);
    diaFin.setHours(23, 59, 59, 999);

    const { data: funcionesExistentes, error: errorFunciones } = await this.supabase
      .from('funciones')
      .select('*, pelicula:peliculas(duracion_minutos)')
      .gte('fecha_hora', diaInicio.toISOString())
      .lte('fecha_hora', diaFin.toISOString());

    if (errorFunciones) {
      return { sala: null, fechaHoraFin: fechaHoraFinStr, error: 'Error al consultar funciones programadas.' };
    }

    // 3. Evaluar sala por sala en orden
    for (const sala of salas) {
      const funcionesDeEstaSala = (funcionesExistentes || []).filter(f => f.sala_id === sala.id);

      // Verificar si alguna función de esta sala se solapa con el intervalo deseado
      const tieneSolapamiento = funcionesDeEstaSala.some(f => {
        const existInicio = new Date(f.fecha_hora).getTime();
        // Usamos fecha_hora_fin si existe, o calculamos inicio + duracion + 30 min buffer
        let existFin = f.fecha_hora_fin ? new Date(f.fecha_hora_fin).getTime() : 0;
        if (!existFin) {
          const dur = f.pelicula?.duracion_minutos || 120;
          existFin = existInicio + (dur + 30) * 60 * 1000;
        }

        // Condición de solapamiento entre intervalos [inicioMs, finMs] y [existInicio, existFin]
        return inicioMs < existFin && existInicio < finMs;
      });

      // Si no tiene solapamiento, esta sala está disponible automáticamente
      if (!tieneSolapamiento) {
        return {
          sala: sala as Sala,
          fechaHoraFin: fechaHoraFinStr
        };
      }
    }

    // Si todas las salas tienen conflicto
    return {
      sala: null,
      fechaHoraFin: fechaHoraFinStr,
      error: 'Todas las salas se encuentran ocupadas en ese rango horario (incluyendo el margen de 30 min de limpieza). Por favor elige otro horario.'
    };
  }

  // Crear función y registrar en auditoría
  async crearFuncion(datos: {
    pelicula_id: number;
    sala_id: number;
    fecha_hora: string;
    fecha_hora_fin: string;
    formato: string;
    idioma: string;
    precio_base: number;
  }) {
    const { data, error } = await this.supabase
      .from('funciones')
      .insert({
        pelicula_id: datos.pelicula_id,
        sala_id: datos.sala_id,
        fecha_hora: datos.fecha_hora,
        fecha_hora_fin: datos.fecha_hora_fin,
        formato: datos.formato,
        idioma: datos.idioma,
        precio_base: datos.precio_base
      })
      .select('*, pelicula:peliculas(titulo), sala:salas(nombre)')
      .single();

    if (error) throw error;

    // Registrar en auditoría
    const user = this.authService.currentUser();
    await this.registrarAuditoria(
      'CREAR_FUNCION',
      {
        funcion_id: data.id,
        pelicula: data.pelicula?.titulo,
        sala: data.sala?.nombre,
        fecha_hora: datos.fecha_hora,
        precio_base: datos.precio_base
      },
      user?.email || 'Admin'
    );

    return data;
  }

  // Obtener todas las funciones programadas
  async getFuncionesProgramadas(): Promise<Funcion[]> {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('*, pelicula:peliculas(*), sala:salas(*)')
      .order('fecha_hora', { ascending: true });

    if (error) throw error;
    return (data as Funcion[]) || [];
  }

  // Eliminar función
  async eliminarFuncion(id: number, descripcion?: string) {
    const { error } = await this.supabase
      .from('funciones')
      .delete()
      .eq('id', id);

    if (error) throw error;

    const user = this.authService.currentUser();
    await this.registrarAuditoria(
      'ELIMINAR_FUNCION',
      { funcion_id: id, detalle: descripcion || 'Función cancelada por administración' },
      user?.email || 'Admin'
    );
  }

  // =====================================================
  // 2. REPORTES Y ANALÍTICAS FINANCIERAS
  // =====================================================
  async getReporteFacturacion(): Promise<ReporteFacturacion> {
    const { data: compras, error } = await this.supabase
      .from('compras')
      .select('total, created_at, estado')
      .eq('estado', 'completada');

    if (error) throw error;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let totalFacturado = 0;
    let facturacionHoy = 0;

    (compras || []).forEach(c => {
      const monto = Number(c.total || 0);
      totalFacturado += monto;
      if (new Date(c.created_at) >= hoy) {
        facturacionHoy += monto;
      }
    });

    // Conteo de entradas vendidas
    const { count: totalEntradas } = await this.supabase
      .from('entradas')
      .select('*', { count: 'exact', head: true });

    // Conteo de items de candy vendidos
    const { data: candyItems } = await this.supabase
      .from('compras_candy_items')
      .select('cantidad');

    const totalCandyVendidos = (candyItems || []).reduce((acc, i) => acc + (i.cantidad || 1), 0);

    return {
      totalFacturado,
      facturacionHoy,
      totalEntradasVendidas: totalEntradas || 0,
      totalCandyVendidos
    };
  }

  // Ranking de películas más vistas (semanal / mensual)
  async getTopPeliculasVistas(periodo: 'semana' | 'mes'): Promise<PeliculaRanking[]> {
    const dias = periodo === 'semana' ? 7 : 30;
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('entradas')
      .select(`
        id,
        precio,
        created_at,
        funcion:funciones(
          pelicula:peliculas(id, titulo, imagen_url)
        )
      `)
      .gte('created_at', desde);

    if (error) {
      console.error('Error al calcular ranking de películas:', error);
      return [];
    }

    // Agrupar por película
    const map = new Map<number, PeliculaRanking>();

    (data || []).forEach((e: any) => {
      const pelicula = e.funcion?.pelicula;
      if (!pelicula) return;

      const curr = map.get(pelicula.id) || {
        peliculaId: pelicula.id,
        titulo: pelicula.titulo,
        imagenUrl: pelicula.imagen_url,
        entradasVendidas: 0,
        totalRecaudado: 0
      };

      curr.entradasVendidas += 1;
      curr.totalRecaudado += Number(e.precio || 0);
      map.set(pelicula.id, curr);
    });

    // Si hay pocas o ninguna entrada aún en la ventana, incluir las películas activas para visualización
    if (map.size === 0) {
      const { data: peliculas } = await this.supabase
        .from('peliculas')
        .select('id, titulo, imagen_url')
        .limit(5);

      (peliculas || []).forEach(p => {
        map.set(p.id, {
          peliculaId: p.id,
          titulo: p.titulo,
          imagenUrl: p.imagen_url,
          entradasVendidas: 0,
          totalRecaudado: 0
        });
      });
    }

    return Array.from(map.values()).sort((a, b) => b.entradasVendidas - a.entradasVendidas);
  }

  // Ranking de productos de Candy Bar más vendidos
  async getTopCandyVendidos(): Promise<CandyRanking[]> {
    const { data, error } = await this.supabase
      .from('compras_candy_items')
      .select(`
        cantidad,
        precio_unitario,
        producto:productos_candy(nombre, categoria),
        combo:combos_especiales(nombre)
      `);

    if (error) {
      console.error('Error al calcular ranking de candy:', error);
      return [];
    }

    const map = new Map<string, CandyRanking>();

    (data || []).forEach((item: any) => {
      const nombre = item.combo?.nombre || item.producto?.nombre || 'Snack';
      const categoria = item.combo ? 'combos' : (item.producto?.categoria || 'candy');

      const curr = map.get(nombre) || {
        nombre,
        categoria,
        cantidadVendida: 0,
        totalRecaudado: 0
      };

      const cant = Number(item.cantidad || 1);
      curr.cantidadVendida += cant;
      curr.totalRecaudado += cant * Number(item.precio_unitario || 0);
      map.set(nombre, curr);
    });

    // Si está vacío, poblar con productos catálogo
    if (map.size === 0) {
      const { data: prods } = await this.supabase
        .from('productos_candy')
        .select('nombre, categoria');
      (prods || []).forEach(p => {
        map.set(p.nombre, {
          nombre: p.nombre,
          categoria: p.categoria,
          cantidadVendida: 0,
          totalRecaudado: 0
        });
      });
    }

    return Array.from(map.values()).sort((a, b) => b.cantidadVendida - a.cantidadVendida);
  }

  // =====================================================
  // 3. AUDITORÍA Y REALTIME (Clase 6)
  // =====================================================
  async registrarAuditoria(accion: string, detalles: any, usuarioEmail?: string) {
    const user = this.authService.currentUser();
    await this.supabase.from('auditoria').insert({
      usuario_id: user ? user.id : null,
      usuario_email: usuarioEmail || user?.email || 'Administración',
      accion,
      detalles
    });
  }

  async getLogsAuditoria(): Promise<LogAuditoria[]> {
    const { data, error } = await this.supabase
      .from('auditoria')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data as LogAuditoria[]) || [];
  }

  // Suscripción Realtime a eventos de auditoría (Clase 6)
  suscribirAuditoria(onNuevoLog: (log: LogAuditoria) => void) {
    const canal = this.supabase
      .channel('auditoria_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auditoria' },
        (payload) => {
          onNuevoLog(payload.new as LogAuditoria);
        }
      )
      .subscribe();

    return canal;
  }

  // Prevención de fugas de memoria con removeChannel (Clase 6 - Diapositiva 10)
  desuscribirCanal(canal: any) {
    if (canal) {
      this.supabase.removeChannel(canal);
    }
  }

  // =====================================================
  // 4. GESTIÓN DE CATÁLOGO Y FIDELIZACIÓN
  // =====================================================
  async getPeliculas(): Promise<Pelicula[]> {
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return (data as Pelicula[]) || [];
  }

  async guardarPelicula(pelicula: Partial<Pelicula>): Promise<Pelicula> {
    let result: Pelicula;
    const user = this.authService.currentUser();

    if (pelicula.id) {
      const { data, error } = await this.supabase
        .from('peliculas')
        .update(pelicula)
        .eq('id', pelicula.id)
        .select()
        .single();
      if (error) throw error;
      result = data as Pelicula;

      await this.registrarAuditoria(
        'MODIFICAR_PELICULA',
        { pelicula_id: result.id, titulo: result.titulo, precio: result.precio_normal },
        user?.email || 'Admin'
      );
    } else {
      const { data, error } = await this.supabase
        .from('peliculas')
        .insert(pelicula)
        .select()
        .single();
      if (error) throw error;
      result = data as Pelicula;

      await this.registrarAuditoria(
        'CREAR_PELICULA',
        { pelicula_id: result.id, titulo: result.titulo },
        user?.email || 'Admin'
      );
    }
    return result;
  }

  async getProductosCandy(): Promise<ProductoCandy[]> {
    const { data, error } = await this.supabase
      .from('productos_candy')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return (data as ProductoCandy[]) || [];
  }

  async guardarProductoCandy(prod: Partial<ProductoCandy>) {
    const user = this.authService.currentUser();
    if (prod.id) {
      const { data, error } = await this.supabase
        .from('productos_candy')
        .update(prod)
        .eq('id', prod.id)
        .select()
        .single();
      if (error) throw error;
      await this.registrarAuditoria('MODIFICAR_CANDY', { producto: prod.nombre, precio: prod.precio }, user?.email || 'Admin');
      return data;
    } else {
      const { data, error } = await this.supabase
        .from('productos_candy')
        .insert(prod)
        .select()
        .single();
      if (error) throw error;
      await this.registrarAuditoria('CREAR_CANDY', { producto: prod.nombre, precio: prod.precio }, user?.email || 'Admin');
      return data;
    }
  }

  async getCombosEspeciales(): Promise<ComboEspecial[]> {
    const { data, error } = await this.supabase
      .from('combos_especiales')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return (data as ComboEspecial[]) || [];
  }

  async guardarComboEspecial(combo: Partial<ComboEspecial>) {
    const user = this.authService.currentUser();
    if (combo.id) {
      const { data, error } = await this.supabase
        .from('combos_especiales')
        .update(combo)
        .eq('id', combo.id)
        .select()
        .single();
      if (error) throw error;
      await this.registrarAuditoria('MODIFICAR_COMBO', { combo: combo.nombre, precio: combo.precio }, user?.email || 'Admin');
      return data;
    } else {
      const { data, error } = await this.supabase
        .from('combos_especiales')
        .insert(combo)
        .select()
        .single();
      if (error) throw error;
      await this.registrarAuditoria('CREAR_COMBO', { combo: combo.nombre, precio: combo.precio }, user?.email || 'Admin');
      return data;
    }
  }

  async getCupones() {
    const { data, error } = await this.supabase
      .from('cupones')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async guardarCupon(cupon: any) {
    const user = this.authService.currentUser();
    if (cupon.id) {
      const { data, error } = await this.supabase
        .from('cupones')
        .update(cupon)
        .eq('id', cupon.id)
        .select()
        .single();
      if (error) throw error;
      await this.registrarAuditoria('MODIFICAR_CUPON', { codigo: cupon.codigo, porcentaje: cupon.porcentaje_descuento }, user?.email || 'Admin');
      return data;
    } else {
      const { data, error } = await this.supabase
        .from('cupones')
        .insert(cupon)
        .select()
        .single();
      if (error) throw error;
      await this.registrarAuditoria('CREAR_CUPON', { codigo: cupon.codigo, porcentaje: cupon.porcentaje_descuento }, user?.email || 'Admin');
      return data;
    }
  }

  // =====================================================
  // 5. EXPORTACIÓN DE REPORTES (PDF Y EXCEL)
  // =====================================================
  async exportarReportePDF(resumen: ReporteFacturacion, peliculas: PeliculaRanking[]) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const fechaReporte = new Date().toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Cabecera institucional
    doc.setFillColor(18, 22, 31);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CINEMA APP — REPORTE DE FACTURACIÓN', 14, 22);

    doc.setTextColor(245, 197, 24);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${fechaReporte} • Panel de Administración`, 14, 32);

    // Resumen Ejecutivo (KPIs)
    let y = 55;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. RESUMEN FINANCIERO EJECUTIVO', 14, y);

    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`• Recaudación Histórica Total: $${resumen.totalFacturado.toLocaleString()}`, 16, y);
    y += 7;
    doc.text(`• Facturación del Día de Hoy: $${resumen.facturacionHoy.toLocaleString()}`, 16, y);
    y += 7;
    doc.text(`• Total de Entradas de Cine Vendidas: ${resumen.totalEntradasVendidas} butacas`, 16, y);
    y += 7;
    doc.text(`• Total de Snacks / Combos de Candy Bar Vendidos: ${resumen.totalCandyVendidos} unidades`, 16, y);

    // Tabla de Películas más vistas
    y += 18;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. RANKING DE PELÍCULAS POR VENTA DE ENTRADAS', 14, y);

    y += 8;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Película', 18, y + 5.5);
    doc.text('Entradas Vendidas', 110, y + 5.5);
    doc.text('Total Recaudado (ARS)', 155, y + 5.5);

    y += 10;
    doc.setFont('helvetica', 'normal');
    peliculas.forEach((p, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${idx + 1}. ${p.titulo}`, 18, y);
      doc.text(`${p.entradasVendidas} tickets`, 110, y);
      doc.text(`$${p.totalRecaudado.toLocaleString()}`, 155, y);
      y += 6.5;
    });

    // Pie de página
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('CinemaApp PWA • Sistema de Gestión de Salas y Funciones • Programación IV', 105, 288, { align: 'center' });

    doc.save(`Reporte_Facturacion_CinemaApp_${Date.now()}.pdf`);
  }

  // Exportar a archivo compatible con Excel (CSV con UTF-8 BOM para apertura nativa en Excel)
  async exportarReporteExcel() {
    const { data: compras, error } = await this.supabase
      .from('compras')
      .select('id, created_at, nombre_contacto, email_contacto, total, descuento_aplicado, metodo_pago, qr_codigo, estado')
      .order('created_at', { ascending: false });

    if (error || !compras) {
      alert('No se pudieron obtener los datos para el reporte.');
      return;
    }

    const encabezados = ['ID Compra', 'Fecha y Hora', 'Cliente', 'Email', 'Total (ARS)', 'Descuento', 'Metodo de Pago', 'Codigo QR', 'Estado'];
    const filas = compras.map(c => [
      c.id,
      new Date(c.created_at).toLocaleString('es-AR'),
      `"${c.nombre_contacto.replace(/"/g, '""')}"`,
      c.email_contacto,
      c.total,
      c.descuento_aplicado || 0,
      c.metodo_pago,
      c.qr_codigo,
      c.estado
    ]);

    const csvContenido = '\uFEFF' + [
      encabezados.join(';'),
      ...filas.map(f => f.join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContenido], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Ventas_CinemaApp_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
