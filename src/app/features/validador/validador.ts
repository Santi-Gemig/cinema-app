import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { CompraService } from '../../core/services/compra.service';
import { AuthService } from '../../core/services/auth.service';
import { Compra } from '../../core/models/compra.interface';

@Component({
  selector: 'app-validador',
  standalone: true,
  imports: [FormsModule, DatePipe, UpperCasePipe],
  templateUrl: './validador.html',
  styleUrl: './validador.css'
})
export class ValidadorComponent {
  private compraService = inject(CompraService);
  authService = inject(AuthService);

  codigoInput = signal<string>('');
  cargando = signal<boolean>(false);
  errorMsg = signal<string | null>(null);
  compraEncontrada = signal<Compra | null>(null);
  feedbackValidacion = signal<string | null>(null);

  // Buscar código ingresado manualmente o simulado
  async buscarCodigo(codigo?: string) {
    const cod = (codigo || this.codigoInput()).trim().toUpperCase();
    if (!cod) return;

    try {
      this.cargando.set(true);
      this.errorMsg.set(null);
      this.feedbackValidacion.set(null);

      const { data, error } = await this.compraService.validarCodigo(cod);

      if (error || !data) {
        this.errorMsg.set(error || 'Código no encontrado');
        this.compraEncontrada.set(null);
        return;
      }

      this.compraEncontrada.set(data);
    } catch (err: any) {
      this.errorMsg.set('Error en la búsqueda: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  // Marcar sector como validado (Cine o Candy)
  async validarSector(sector: 'cine' | 'candy') {
    const compra = this.compraEncontrada();
    if (!compra) return;

    try {
      this.cargando.set(true);
      const { error } = await this.compraService.marcarValidado(compra.id, sector);

      if (error) {
        this.errorMsg.set('No se pudo validar: ' + error.message);
        return;
      }

      // Actualizar vista localmente
      if (sector === 'cine') {
        compra.qr_usado_cine = true;
        compra.qr_cine_validado_at = new Date().toISOString();
        this.feedbackValidacion.set('✅ ¡Entrada de Cine validada exitosamente! El espectador puede ingresar a la sala.');
      } else {
        compra.qr_usado_candy = true;
        compra.qr_candy_validado_at = new Date().toISOString();
        this.feedbackValidacion.set('🍿 ¡Candy Bar entregado! El QR para snacks ha quedado invalidado.');
      }

      this.compraEncontrada.set({ ...compra });
    } catch (err: any) {
      this.errorMsg.set('Error: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  // Limpiar para escanear siguiente
  nuevoEscaneo() {
    this.codigoInput.set('');
    this.compraEncontrada.set(null);
    this.errorMsg.set(null);
    this.feedbackValidacion.set(null);
  }
}
