import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { CartService } from '../../core/services/cart.service';
import { CompraService } from '../../core/services/compra.service';
import { AuthService } from '../../core/services/auth.service';
import { Compra } from '../../core/models/compra.interface';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink, UpperCasePipe],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class CheckoutComponent implements OnInit {
  cartService = inject(CartService);
  compraService = inject(CompraService);
  authService = inject(AuthService);
  private router = inject(Router);

  cargando = signal<boolean>(false);
  errorMsg = signal<string | null>(null);

  // Cupones y Crédito
  codigoCupon = signal<string>('');
  porcentajeDescuento = signal<number>(0);
  cuponAplicado = signal<string | null>(null);
  cuponError = signal<string | null>(null);
  usarCredito = signal<boolean>(false);

  // Estado post-compra
  compraRealizada = signal<Compra | null>(null);
  qrDataUrl = signal<string | null>(null);

  form = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    metodoPago: new FormControl('Tarjeta de Crédito', [Validators.required])
  });

  // Cálculos de totales
  descuentoMonto = computed(() => {
    const sub = this.cartService.totalGeneral();
    return (sub * this.porcentajeDescuento()) / 100;
  });

  creditoDisponible = computed(() => {
    return this.authService.currentUserData()?.credito || 0;
  });

  creditoAplicado = computed(() => {
    if (!this.usarCredito()) return 0;
    const restante = this.cartService.totalGeneral() - this.descuentoMonto();
    return Math.min(this.creditoDisponible(), Math.max(0, restante));
  });

  totalPagar = computed(() => {
    const sub = this.cartService.totalGeneral();
    const final = sub - this.descuentoMonto() - this.creditoAplicado();
    return Math.max(0, final);
  });

  puntosAGanar = computed(() => Math.floor(this.totalPagar()));

  ngOnInit() {
    // Si no hay nada en el carrito, volver al inicio
    if (this.cartService.totalItemsCount() === 0 && !this.compraRealizada()) {
      this.router.navigate(['/']);
      return;
    }

    // Si el usuario está logueado, autocompletar nombre y email
    const u = this.authService.currentUserData();
    const curUser = this.authService.currentUser();
    if (u) {
      this.form.patchValue({
        nombre: `${u.nombre} ${u.apellido}`,
        email: u.email
      });
    } else if (curUser?.email) {
      this.form.patchValue({ email: curUser.email });
    }
  }

  // Aplicar cupón de descuento
  async aplicarCupon() {
    const codigo = this.codigoCupon().trim();
    if (!codigo) return;

    this.cuponError.set(null);
    let edad: number | undefined;

    const u = this.authService.currentUserData();
    if (u?.fecha_nacimiento) {
      const birth = new Date(u.fecha_nacimiento);
      const today = new Date();
      edad = today.getFullYear() - birth.getFullYear();
    }

    const res = await this.compraService.validarCupon(codigo, edad);
    if (res.error) {
      this.cuponError.set(res.error);
      this.porcentajeDescuento.set(0);
      this.cuponAplicado.set(null);
    } else {
      this.porcentajeDescuento.set(res.porcentaje);
      this.cuponAplicado.set(codigo);
      this.cuponError.set(null);
    }
  }

  // Ejecutar el pago y registro
  async realizarPago() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg.set('Por favor completa tu nombre y un correo electrónico válido para recibir tus entradas digitales.');
      return;
    }

    try {
      this.cargando.set(true);
      this.errorMsg.set(null);

      const val = this.form.value;

      // Entradas
      const entradasPayload = this.cartService.entradas().map(e => ({
        funcion_id: e.funcion.id,
        fila: e.butaca.fila,
        numero: e.butaca.numero,
        tipo: e.butaca.tipo,
        precio: e.butaca.precio
      }));

      // Candy
      const candyPayload: any[] = [];
      this.cartService.candyItems().forEach(i => {
        candyPayload.push({
          producto_id: i.producto.id,
          nombre: i.producto.nombre,
          cantidad: i.cantidad,
          precio_unitario: i.producto.precio
        });
      });
      this.cartService.comboItems().forEach(i => {
        candyPayload.push({
          combo_id: i.combo.id,
          nombre: i.combo.nombre,
          cantidad: i.cantidad,
          precio_unitario: i.combo.precio
        });
      });

      const compra = await this.compraService.procesarCompra({
        nombre: val.nombre!,
        email: val.email!,
        entradas: entradasPayload,
        candyItems: candyPayload,
        total: this.totalPagar(),
        descuento: this.descuentoMonto(),
        cuponCodigo: this.cuponAplicado() || undefined,
        creditoUsado: this.creditoAplicado(),
        metodoPago: val.metodoPago!
      });

      // Generar imagen QR
      const qrUrl = await QRCode.toDataURL(compra.qr_codigo, { width: 300 });
      this.qrDataUrl.set(qrUrl);
      this.compraRealizada.set(compra);

      // Guardar snapshot del carrito para el PDF
      const snapshot = {
        entradas: [...this.cartService.entradas()],
        candyItems: [...this.cartService.candyItems()],
        comboItems: [...this.cartService.comboItems()]
      };
      this.cartSnapshot.set(snapshot);

      // Limpiar carrito
      this.cartService.clear();
    } catch (err: any) {
      this.errorMsg.set('Error al procesar la compra: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  cartSnapshot = signal<any>(null);

  // Descargar PDF
  async descargarPDF() {
    const compra = this.compraRealizada();
    const snap = this.cartSnapshot();
    if (!compra || !snap) return;

    const primeraEntrada = snap.entradas[0];

    await this.compraService.generarEntradaPDF({
      peliculaTitulo: primeraEntrada?.funcion?.pelicula?.titulo || 'Película de Cine',
      salaNombre: primeraEntrada?.funcion?.sala?.nombre || 'Sala Principal',
      fechaHora: primeraEntrada?.funcion?.fecha_hora || new Date().toLocaleString(),
      formato: primeraEntrada?.funcion?.formato || '2D Digital',
      idioma: primeraEntrada?.funcion?.idioma || 'Castellano',
      comprador: compra.nombre_contacto,
      qrCodigo: compra.qr_codigo,
      butacas: snap.entradas.map((e: any) => ({
        fila: e.butaca.fila,
        numero: e.butaca.numero,
        tipo: e.butaca.tipo
      })),
      candyItems: snap.candyItems.map((c: any) => ({
        nombre: c.producto.nombre,
        cantidad: c.cantidad
      })).concat(snap.comboItems.map((cb: any) => ({
        nombre: cb.combo.nombre,
        cantidad: cb.cantidad
      }))),
      total: compra.total
    });
  }
}
