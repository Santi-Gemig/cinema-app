import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { DatePipe, UpperCasePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  ReporteFacturacion,
  PeliculaRanking,
  CandyRanking,
  LogAuditoria
} from '../../core/services/admin.service';
import { Pelicula } from '../../core/models/pelicula.interface';
import { Funcion } from '../../core/models/funcion.interface';
import { ProductoCandy, ComboEspecial } from '../../core/models/candy.interface';
import { ResaltarDirective } from '../../shared/directives/resaltar.directive';

type AdminTab = 'dashboard' | 'funciones' | 'peliculas' | 'candy' | 'cupones' | 'auditoria';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [DatePipe, UpperCasePipe, DecimalPipe, JsonPipe, FormsModule, ResaltarDirective],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);

  tabActiva = signal<AdminTab>('dashboard');
  cargando = signal<boolean>(false);
  mensajeExito = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  // 1. DASHBOARD Y ANALÍTICAS
  reporte = signal<ReporteFacturacion>({
    totalFacturado: 0,
    facturacionHoy: 0,
    totalEntradasVendidas: 0,
    totalCandyVendidos: 0
  });
  periodoRanking = signal<'semana' | 'mes'>('semana');
  rankingPeliculas = signal<PeliculaRanking[]>([]);
  rankingCandy = signal<CandyRanking[]>([]);

  // 2. FUNCIONES & ASIGNACIÓN AUTOMÁTICA DE SALAS
  funciones = signal<Funcion[]>([]);
  peliculasLista = signal<Pelicula[]>([]);
  
  // Formulario programar función
  peliculaSeleccionadaId = signal<number | null>(null);
  fechaProgramar = signal<string>(new Date().toISOString().split('T')[0]);
  horaProgramar = signal<string>('18:00');
  formatoProgramar = signal<string>('2D');
  idiomaProgramar = signal<string>('Castellano');
  precioBaseProgramar = signal<number>(5000);

  // Resultado de la verificación automática de sala
  salaAsignada = signal<any | null>(null);
  fechaHoraFinAsignada = signal<string | null>(null);
  conflictoSalaError = signal<string | null>(null);
  verificandoSala = signal<boolean>(false);
  programandoFuncion = signal<boolean>(false);

  // 3. GESTIÓN DE PELÍCULAS
  modalPeliculaVisible = signal<boolean>(false);
  peliculaEnEdicion = signal<Partial<Pelicula>>({
    titulo: '',
    sinopsis: '',
    duracion_minutos: 120,
    imagen_url: '',
    clasificacion_edad: 'ATP',
    generos: ['Acción'],
    formatos: ['2D'],
    idiomas: ['Castellano'],
    precio_normal: 5000,
    precio_preventa: 4200,
    en_cartelera: true,
    es_estreno: false
  });
  generoInput = signal<string>('Acción, Aventura');

  // Supabase Storage para Películas (Clase 7)
  archivoSeleccionadoPelicula = signal<File | null>(null);
  previewUrlPelicula = signal<string | null>(null);

  // 4. CANDY BAR Y COMBOS
  productosCandy = signal<ProductoCandy[]>([]);
  combosEspeciales = signal<ComboEspecial[]>([]);
  modalCandyVisible = signal<boolean>(false);
  itemCandyEnEdicion = signal<Partial<ProductoCandy>>({
    nombre: '',
    categoria: 'pochoclos',
    descripcion: '',
    precio: 2500,
    puntos_canje: 150,
    imagen_url: '',
    activo: true
  });

  // Supabase Storage para Candy Bar (Clase 7)
  archivoSeleccionadoCandy = signal<File | null>(null);
  previewUrlCandy = signal<string | null>(null);

  modalComboVisible = signal<boolean>(false);
  comboEnEdicion = signal<Partial<ComboEspecial>>({
    nombre: '',
    descripcion: '',
    precio: 8500,
    incluye_entrada: true,
    imagen_url: '',
    activo: true
  });

  // 5. CUPONES DE DESCUENTO
  cupones = signal<any[]>([]);
  modalCuponVisible = signal<boolean>(false);
  cuponEnEdicion = signal<any>({
    codigo: '',
    descripcion: '',
    porcentaje_descuento: 20,
    solo_mayores_50: false,
    primera_compra: false,
    activo: true
  });

  // 6. LOGS DE AUDITORÍA EN TIEMPO REAL (Clase 6)
  logsAuditoria = signal<LogAuditoria[]>([]);
  private canalAuditoria: any = null;

  async ngOnInit() {
    await this.cargarTodo();
    this.iniciarAuditoriaRealtime();
  }

  ngOnDestroy() {
    // Liberar memoria de previews de Supabase Storage (Clase 7)
    if (this.previewUrlPelicula()) {
      URL.revokeObjectURL(this.previewUrlPelicula()!);
    }
    if (this.previewUrlCandy()) {
      URL.revokeObjectURL(this.previewUrlCandy()!);
    }

    // Prevención de fugas de memoria con removeChannel (Clase 6 - Diapositiva 10)
    if (this.canalAuditoria) {
      this.adminService.desuscribirCanal(this.canalAuditoria);
    }
  }

  async cargarTodo() {
    try {
      this.cargando.set(true);
      const [rep, pelis, prods, cmbs, cups, funcs, aud] = await Promise.all([
        this.adminService.getReporteFacturacion(),
        this.adminService.getPeliculas(),
        this.adminService.getProductosCandy(),
        this.adminService.getCombosEspeciales(),
        this.adminService.getCupones(),
        this.adminService.getFuncionesProgramadas(),
        this.adminService.getLogsAuditoria()
      ]);

      this.reporte.set(rep);
      this.peliculasLista.set(pelis);
      this.productosCandy.set(prods);
      this.combosEspeciales.set(cmbs);
      this.cupones.set(cups);
      this.funciones.set(funcs);
      this.logsAuditoria.set(aud);

      if (pelis.length > 0 && !this.peliculaSeleccionadaId()) {
        this.peliculaSeleccionadaId.set(pelis[0].id);
      }

      await this.cargarRankings();
    } catch (err: any) {
      this.errorMsg.set('Error al cargar datos administrativos: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  async cargarRankings() {
    const [pRank, cRank] = await Promise.all([
      this.adminService.getTopPeliculasVistas(this.periodoRanking()),
      this.adminService.getTopCandyVendidos()
    ]);
    this.rankingPeliculas.set(pRank);
    this.rankingCandy.set(cRank);
  }

  async cambiarPeriodoRanking(periodo: 'semana' | 'mes') {
    this.periodoRanking.set(periodo);
    const pRank = await this.adminService.getTopPeliculasVistas(periodo);
    this.rankingPeliculas.set(pRank);
  }

  // Suscripción WebSocket a auditoría en tiempo real
  iniciarAuditoriaRealtime() {
    this.canalAuditoria = this.adminService.suscribirAuditoria((nuevoLog) => {
      this.logsAuditoria.set([nuevoLog, ...this.logsAuditoria()]);
    });
  }

  // =====================================================
  // ASIGNACIÓN AUTOMÁTICA DE SALAS (REGLA DE NEGOCIO CRÍTICA)
  // =====================================================
  async verificarYAsignarSala() {
    const peliId = this.peliculaSeleccionadaId();
    if (!peliId) {
      this.conflictoSalaError.set('Selecciona una película.');
      return;
    }

    const peli = this.peliculasLista().find(p => p.id === Number(peliId));
    if (!peli) return;

    this.verificandoSala.set(true);
    this.conflictoSalaError.set(null);
    this.salaAsignada.set(null);

    const fechaHoraInicioStr = `${this.fechaProgramar()}T${this.horaProgramar()}:00`;

    try {
      const res = await this.adminService.asignarSalaAutomatica(fechaHoraInicioStr, peli.duracion_minutos);

      if (res.error) {
        this.conflictoSalaError.set(res.error);
      } else {
        this.salaAsignada.set(res.sala);
        this.fechaHoraFinAsignada.set(res.fechaHoraFin);
      }
    } catch (err: any) {
      this.conflictoSalaError.set('Error al verificar salas: ' + err.message);
    } finally {
      this.verificandoSala.set(false);
    }
  }

  async confirmarProgramacionFuncion() {
    if (!this.salaAsignada() || !this.fechaHoraFinAsignada()) {
      await this.verificarYAsignarSala();
      if (!this.salaAsignada()) return;
    }

    try {
      this.programandoFuncion.set(true);
      const fechaHoraInicioStr = `${this.fechaProgramar()}T${this.horaProgramar()}:00`;

      await this.adminService.crearFuncion({
        pelicula_id: Number(this.peliculaSeleccionadaId()),
        sala_id: this.salaAsignada().id,
        fecha_hora: new Date(fechaHoraInicioStr).toISOString(),
        fecha_hora_fin: this.fechaHoraFinAsignada()!,
        formato: this.formatoProgramar(),
        idioma: this.idiomaProgramar(),
        precio_base: this.precioBaseProgramar()
      });

      this.mensajeExito.set(`¡Función programada con éxito en ${this.salaAsignada().nombre}!`);
      this.salaAsignada.set(null);
      this.fechaHoraFinAsignada.set(null);

      // Recargar listado de funciones
      const f = await this.adminService.getFuncionesProgramadas();
      this.funciones.set(f);

      setTimeout(() => this.mensajeExito.set(null), 5000);
    } catch (err: any) {
      this.errorMsg.set('Error al guardar función: ' + err.message);
    } finally {
      this.programandoFuncion.set(false);
    }
  }

  async eliminarFuncion(id: number) {
    if (!confirm('¿Seguro que deseas eliminar esta función?')) return;
    try {
      await this.adminService.eliminarFuncion(id);
      this.funciones.set(this.funciones().filter(f => f.id !== id));
      this.mensajeExito.set('Función eliminada correctamente.');
      setTimeout(() => this.mensajeExito.set(null), 4000);
    } catch (err: any) {
      this.errorMsg.set('Error al eliminar función: ' + err.message);
    }
  }

  // Preajustes rápidos de horarios
  aplicarPreajuste(diasAdicionales: number, hora: string) {
    const d = new Date();
    d.setDate(d.getDate() + diasAdicionales);
    this.fechaProgramar.set(d.toISOString().split('T')[0]);
    this.horaProgramar.set(hora);
    this.salaAsignada.set(null);
    this.conflictoSalaError.set(null);
  }

  // =====================================================
  // GESTIÓN DE PELÍCULAS (Con Supabase Storage - Clase 7)
  // =====================================================
  seleccionarArchivoPelicula(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const archivo = input.files[0];
    this.archivoSeleccionadoPelicula.set(archivo);

    const prev = this.previewUrlPelicula();
    if (prev) URL.revokeObjectURL(prev);
    this.previewUrlPelicula.set(URL.createObjectURL(archivo));
  }

  abrirModalPelicula(pelicula?: Pelicula) {
    const prev = this.previewUrlPelicula();
    if (prev) URL.revokeObjectURL(prev);
    this.archivoSeleccionadoPelicula.set(null);
    this.previewUrlPelicula.set(null);

    if (pelicula) {
      this.peliculaEnEdicion.set({ ...pelicula });
      this.generoInput.set((pelicula.generos || []).join(', '));
    } else {
      this.peliculaEnEdicion.set({
        titulo: '',
        sinopsis: '',
        duracion_minutos: 120,
        imagen_url: '',
        clasificacion_edad: 'ATP',
        generos: ['Acción'],
        formatos: ['2D'],
        idiomas: ['Castellano'],
        precio_normal: 5000,
        precio_preventa: 4200,
        en_cartelera: true,
        es_estreno: false
      });
      this.generoInput.set('Acción, Aventura');
    }
    this.modalPeliculaVisible.set(true);
  }

  async guardarPelicula() {
    const p = this.peliculaEnEdicion();
    const archivo = this.archivoSeleccionadoPelicula();

    if (!p.titulo || !p.sinopsis || (!p.imagen_url && !archivo)) {
      alert('Por favor completa título, sinopsis y selecciona una imagen o ingresa una URL.');
      return;
    }

    const generosArr = this.generoInput().split(',').map(g => g.trim()).filter(Boolean);
    p.generos = generosArr;

    try {
      this.cargando.set(true);

      // Si seleccionó un archivo local, subirlo a Supabase Storage (Clase 7)
      if (archivo) {
        const urlPublica = await this.adminService.subirArchivo(archivo, 'productos');
        p.imagen_url = urlPublica;
      }

      await this.adminService.guardarPelicula(p);
      this.modalPeliculaVisible.set(false);
      this.archivoSeleccionadoPelicula.set(null);
      this.previewUrlPelicula.set(null);
      this.mensajeExito.set('¡Película guardada correctamente con imagen en Supabase Storage!');
      const pelis = await this.adminService.getPeliculas();
      this.peliculasLista.set(pelis);
      setTimeout(() => this.mensajeExito.set(null), 4000);
    } catch (err: any) {
      this.errorMsg.set('Error al guardar película: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  // =====================================================
  // GESTIÓN DE CANDY Y COMBOS (Con Supabase Storage - Clase 7)
  // =====================================================
  seleccionarArchivoCandy(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const archivo = input.files[0];
    this.archivoSeleccionadoCandy.set(archivo);

    const prev = this.previewUrlCandy();
    if (prev) URL.revokeObjectURL(prev);
    this.previewUrlCandy.set(URL.createObjectURL(archivo));
  }

  abrirModalCandy(producto?: ProductoCandy) {
    const prev = this.previewUrlCandy();
    if (prev) URL.revokeObjectURL(prev);
    this.archivoSeleccionadoCandy.set(null);
    this.previewUrlCandy.set(null);

    if (producto) {
      this.itemCandyEnEdicion.set({ ...producto });
    } else {
      this.itemCandyEnEdicion.set({
        nombre: '',
        categoria: 'pochoclos',
        descripcion: '',
        precio: 2500,
        puntos_canje: 150,
        imagen_url: '',
        activo: true
      });
    }
    this.modalCandyVisible.set(true);
  }

  async guardarCandy() {
    const item = this.itemCandyEnEdicion();
    const archivo = this.archivoSeleccionadoCandy();
    if (!item.nombre || !item.precio) return;

    try {
      this.cargando.set(true);

      // Si seleccionó un archivo local, subirlo a Supabase Storage (Clase 7)
      if (archivo) {
        const urlPublica = await this.adminService.subirArchivo(archivo, 'productos');
        item.imagen_url = urlPublica;
      }

      await this.adminService.guardarProductoCandy(item);
      this.modalCandyVisible.set(false);
      this.archivoSeleccionadoCandy.set(null);
      this.previewUrlCandy.set(null);
      this.mensajeExito.set('Producto de Candy Bar actualizado con imagen en Storage.');
      const prods = await this.adminService.getProductosCandy();
      this.productosCandy.set(prods);
      setTimeout(() => this.mensajeExito.set(null), 4000);
    } catch (err: any) {
      this.errorMsg.set('Error al guardar producto: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  abrirModalCombo(combo?: ComboEspecial) {
    if (combo) {
      this.comboEnEdicion.set({ ...combo });
    } else {
      this.comboEnEdicion.set({
        nombre: '',
        descripcion: '',
        precio: 8500,
        incluye_entrada: true,
        imagen_url: '',
        activo: true
      });
    }
    this.modalComboVisible.set(true);
  }

  async guardarCombo() {
    const item = this.comboEnEdicion();
    if (!item.nombre || !item.precio) return;

    try {
      this.cargando.set(true);
      await this.adminService.guardarComboEspecial(item);
      this.modalComboVisible.set(false);
      this.mensajeExito.set('Combo especial guardado con éxito.');
      const c = await this.adminService.getCombosEspeciales();
      this.combosEspeciales.set(c);
      setTimeout(() => this.mensajeExito.set(null), 4000);
    } catch (err: any) {
      this.errorMsg.set('Error al guardar combo: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  // =====================================================
  // GESTIÓN DE CUPONES
  // =====================================================
  abrirModalCupon(cupon?: any) {
    if (cupon) {
      this.cuponEnEdicion.set({ ...cupon });
    } else {
      this.cuponEnEdicion.set({
        codigo: '',
        descripcion: '',
        porcentaje_descuento: 20,
        solo_mayores_50: false,
        primera_compra: false,
        activo: true
      });
    }
    this.modalCuponVisible.set(true);
  }

  async guardarCupon() {
    const c = this.cuponEnEdicion();
    if (!c.codigo || !c.porcentaje_descuento) return;
    c.codigo = c.codigo.trim().toUpperCase();

    try {
      this.cargando.set(true);
      await this.adminService.guardarCupon(c);
      this.modalCuponVisible.set(false);
      this.mensajeExito.set(`Cupón ${c.codigo} configurado con éxito.`);
      const list = await this.adminService.getCupones();
      this.cupones.set(list);
      setTimeout(() => this.mensajeExito.set(null), 4000);
    } catch (err: any) {
      this.errorMsg.set('Error al guardar cupón: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  // =====================================================
  // EXPORTACIONES DE REPORTES (PDF Y EXCEL)
  // =====================================================
  async descargarReportePDF() {
    try {
      this.cargando.set(true);
      await this.adminService.exportarReportePDF(this.reporte(), this.rankingPeliculas());
      this.mensajeExito.set('Reporte de Facturación en PDF descargado exitosamente.');
      setTimeout(() => this.mensajeExito.set(null), 4000);
    } catch (err: any) {
      this.errorMsg.set('Error al generar PDF: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  async descargarReporteExcel() {
    try {
      this.cargando.set(true);
      await this.adminService.exportarReporteExcel();
      this.mensajeExito.set('Reporte de Ventas en Excel (CSV) descargado con éxito.');
      setTimeout(() => this.mensajeExito.set(null), 4000);
    } catch (err: any) {
      this.errorMsg.set('Error al exportar Excel: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }
}
