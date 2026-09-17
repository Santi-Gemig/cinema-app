import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CompraService } from '../../core/services/compra.service';
import { PeliculaService } from '../../core/services/pelicula.service';
import { Compra } from '../../core/models/compra.interface';
import { ResaltarDirective } from '../../shared/directives/resaltar.directive';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-mis-peliculas',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ResaltarDirective],
  templateUrl: './mis-peliculas.html',
  styleUrl: './mis-peliculas.css'
})
export class MisPeliculasComponent implements OnInit {
  authService = inject(AuthService);
  private compraService = inject(CompraService);
  private peliculaService = inject(PeliculaService);
  private router = inject(Router);

  compras = signal<Compra[]>([]);
  cargando = signal<boolean>(true);
  errorMsg = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  // Modal para ver el código QR
  qrModalVisible = signal<boolean>(false);
  qrModalCodigo = signal<string>('');
  qrModalDataUrl = signal<string | null>(null);
  qrModalCompra = signal<Compra | null>(null);

  // Modal / Formulario para calificar película vista
  modalCalificarVisible = signal<boolean>(false);
  peliculaACalificar = signal<any | null>(null);
  estrellasSeleccionadas = signal<number>(5);
  comentarioResena = signal<string>('');
  enviandoResena = signal<boolean>(false);

  // Datos de usuario calculados
  usuario = computed(() => this.authService.currentUserData());

  async ngOnInit() {
    // Si no está autenticado, redirigir a login
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    await this.cargarCompras();
  }

  async cargarCompras() {
    try {
      this.cargando.set(true);
      this.errorMsg.set(null);
      const user = this.authService.currentUser();
      if (user) {
        const data = await this.compraService.getComprasUsuario(user.id);
        this.compras.set(data);
      }
    } catch (err: any) {
      this.errorMsg.set('No se pudo cargar el historial de compras: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  // Verifica la regla de 2 horas antes de la función
  puedeCancelar(fechaHora: string | undefined): boolean {
    if (!fechaHora) return false;
    const diffMs = new Date(fechaHora).getTime() - Date.now();
    return diffMs >= 2 * 60 * 60 * 1000;
  }

  // Mensaje de estado de cancelación
  motivoNoCancelable(fechaHora: string | undefined): string {
    if (!fechaHora) return 'No disponible';
    const diffMs = new Date(fechaHora).getTime() - Date.now();
    if (diffMs < 0) return 'La función ya finalizó';
    return 'Quedan menos de 2 hs para la función (cancelación cerrada)';
  }

  // Ejecutar cancelación con crédito
  async confirmarCancelacion(compra: Compra, funcionFechaHora: string) {
    const confirmacion = window.confirm(
      `¿Estás seguro de cancelar esta compra por $${compra.total}?\n\nEl 100% del monto se reembolsará automáticamente como CRÉDITO en tu cuenta para futuras compras y las butacas quedarán liberadas.`
    );
    if (!confirmacion) return;

    try {
      this.cargando.set(true);
      const res = await this.compraService.cancelarCompra(compra.id, funcionFechaHora);
      if (res.success) {
        this.mensajeExito.set(`¡Compra cancelada con éxito! Se acreditaron $${compra.total} como saldo a favor en tu perfil.`);
        await this.cargarCompras();
        setTimeout(() => this.mensajeExito.set(null), 6000);
      } else {
        this.errorMsg.set(res.error || 'No se pudo cancelar la compra.');
      }
    } catch (err: any) {
      this.errorMsg.set('Error al cancelar: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  // Abrir visor de QR
  async verQR(compra: Compra) {
    this.qrModalCompra.set(compra);
    this.qrModalCodigo.set(compra.qr_codigo);
    const dataUrl = await QRCode.toDataURL(compra.qr_codigo, { width: 320 });
    this.qrModalDataUrl.set(dataUrl);
    this.qrModalVisible.set(true);
  }

  cerrarQR() {
    this.qrModalVisible.set(false);
    this.qrModalCompra.set(null);
    this.qrModalDataUrl.set(null);
  }

  // Descargar PDF oficial
  async descargarEntradaPDF(compra: Compra) {
    const primeraEntrada = (compra.entradas as any[])?.[0];
    const funcion = primeraEntrada?.funcion;

    await this.compraService.generarEntradaPDF({
      peliculaTitulo: funcion?.pelicula?.titulo || 'Película',
      salaNombre: funcion?.sala?.nombre || 'Sala Principal',
      fechaHora: funcion?.fecha_hora ? new Date(funcion.fecha_hora).toLocaleString('es-AR') : 'Fecha no especificada',
      formato: funcion?.formato || '2D Digital',
      idioma: funcion?.idioma || 'Castellano',
      comprador: compra.nombre_contacto,
      qrCodigo: compra.qr_codigo,
      butacas: ((compra.entradas as any[]) || []).map(e => ({
        fila: e.fila,
        numero: e.numero,
        tipo: e.tipo
      })),
      candyItems: ((compra.compras_candy_items as any[]) || []).map(c => ({
        nombre: c.producto?.nombre || c.combo?.nombre || 'Snack',
        cantidad: c.cantidad
      })),
      total: compra.total
    });
  }

  // Modal para calificar
  abrirCalificacion(pelicula: any) {
    this.peliculaACalificar.set(pelicula);
    this.estrellasSeleccionadas.set(5);
    this.comentarioResena.set('');
    this.modalCalificarVisible.set(true);
  }

  cerrarCalificacion() {
    this.modalCalificarVisible.set(false);
    this.peliculaACalificar.set(null);
  }

  async guardarCalificacion() {
    const p = this.peliculaACalificar();
    const u = this.usuario();
    if (!p || !u) return;

    try {
      this.enviandoResena.set(true);
      await this.peliculaService.agregarReseña({
        pelicula_id: p.id,
        usuario_id: u.id,
        nombre_usuario: `${u.nombre} ${u.apellido}`,
        calificacion: this.estrellasSeleccionadas(),
        comentario: this.comentarioResena().trim() || '¡Excelente experiencia!'
      });

      this.mensajeExito.set('¡Tu calificación y opinión fueron publicadas con éxito!');
      this.cerrarCalificacion();
      setTimeout(() => this.mensajeExito.set(null), 5000);
    } catch (err: any) {
      this.errorMsg.set('Error al guardar reseña: ' + err.message);
    } finally {
      this.enviandoResena.set(false);
    }
  }
}
