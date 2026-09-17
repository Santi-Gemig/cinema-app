import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeliculaService } from '../../core/services/pelicula.service';
import { FuncionService, FilaButacas } from '../../core/services/funcion.service';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { Pelicula, Reseña } from '../../core/models/pelicula.interface';
import { Funcion } from '../../core/models/funcion.interface';
import { Butaca } from '../../core/models/sala.interface';

@Component({
  selector: 'app-pelicula-detalle',
  standalone: true,
  imports: [DatePipe, UpperCasePipe, FormsModule],
  templateUrl: './pelicula-detalle.html',
  styleUrl: './pelicula-detalle.css'
})
export class PeliculaDetalleComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private peliculaService = inject(PeliculaService);
  private funcionService = inject(FuncionService);
  authService = inject(AuthService);
  cartService = inject(CartService);

  pelicula = signal<Pelicula | null>(null);
  funciones = signal<Funcion[]>([]);
  funcionSeleccionada = signal<Funcion | null>(null);
  resenas = signal<Reseña[]>([]);

  // Mapa de la sala
  mapaFilas = signal<FilaButacas[]>([]);
  butacasSeleccionadas = signal<Butaca[]>([]);
  cargando = signal<boolean>(true);
  cargandoButacas = signal<boolean>(false);

  // Nueva reseña
  nuevaCalificacion = signal<number>(5);
  nuevoComentario = signal<string>('');
  enviandoResena = signal<boolean>(false);

  // Suscripción Realtime
  private realtimeCanal: any = null;

  // Promedio de estrellas calculado
  promedioEstrellasTexto = computed(() => {
    const list = this.resenas();
    if (list.length === 0) return 'Sin opiniones aún';
    const suma = list.reduce((acc, r) => acc + r.calificacion, 0);
    return (suma / list.length).toFixed(1);
  });

  totalResenas = computed(() => this.resenas().length);

  // Verificación de edad del usuario según la restricción de la película (+13, +18)
  esAptoPorEdad = computed(() => {
    const p = this.pelicula();
    const u = this.authService.currentUserData();
    if (!p || p.clasificacion_edad === 'ATP') return true;
    if (!u || !u.fecha_nacimiento) return true; // Se valida al momento si es anónimo

    const birthDate = new Date(u.fecha_nacimiento);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (p.clasificacion_edad === '+18' && age < 18) return false;
    if (p.clasificacion_edad === '+13' && age < 13) return false;
    return true;
  });

  // Total por las butacas seleccionadas
  totalButacas = computed(() => {
    return this.butacasSeleccionadas().reduce((acc, b) => acc + b.precio, 0);
  });

  async ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/']);
      return;
    }

    try {
      this.cargando.set(true);
      const [peliculaData, funcionesData, resenasData] = await Promise.all([
        this.peliculaService.getPeliculaById(id),
        this.funcionService.getFuncionesPorPelicula(id),
        this.peliculaService.getReseñas(id)
      ]);

      this.pelicula.set(peliculaData);
      this.funciones.set(funcionesData);
      this.resenas.set(resenasData);

      // Si hay funciones, preseleccionar la primera automáticamente
      if (funcionesData.length > 0) {
        this.seleccionarFuncion(funcionesData[0]);
      }
    } catch (err) {
      console.error('Error al cargar detalle de película:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy() {
    if (this.realtimeCanal) {
      this.funcionService.desuscribirCanal(this.realtimeCanal);
    }
  }

  async seleccionarFuncion(funcion: Funcion) {
    this.funcionSeleccionada.set(funcion);
    this.butacasSeleccionadas.set([]);
    this.cargandoButacas.set(true);

    try {
      // 1. Obtener butacas ya compradas
      const ocupadas = await this.funcionService.getButacasOcupadas(funcion.id);

      // 2. Generar el mapa físico con las reglas inmutables
      const filas = this.funcionService.generarMapaFisico(ocupadas, funcion.precio_base);
      this.mapaFilas.set(filas);

      // 3. Conectar tiempo real con Supabase
      if (this.realtimeCanal) {
        this.realtimeCanal.unsubscribe();
      }
      this.realtimeCanal = this.funcionService.suscribirCambiosButacas(funcion.id, (nuevaEntrada) => {
        // Alguien compró una butaca en tiempo real
        this.actualizarButacaEnTiempoReal(nuevaEntrada.fila, nuevaEntrada.numero);
      });
    } catch (err) {
      console.error('Error al generar sala:', err);
    } finally {
      this.cargandoButacas.set(false);
    }
  }

  // Tocar una butaca para elegirla o deseleccionarla
  toggleButaca(butaca: Butaca) {
    if (butaca.ocupada) return;

    const actuales = [...this.butacasSeleccionadas()];
    const index = actuales.findIndex(b => b.fila === butaca.fila && b.numero === butaca.numero);

    if (index > -1) {
      actuales.splice(index, 1);
      butaca.seleccionada = false;
    } else {
      actuales.push(butaca);
      butaca.seleccionada = true;
    }

    this.butacasSeleccionadas.set(actuales);
  }

  isButacaSeleccionada(butaca: Butaca): boolean {
    return this.butacasSeleccionadas().some(b => b.fila === butaca.fila && b.numero === butaca.numero);
  }

  private actualizarButacaEnTiempoReal(fila: string, numero: number) {
    const filas = [...this.mapaFilas()];
    const filaTarget = filas.find(f => f.letra === fila);
    if (!filaTarget) return;

    const buscarYMarcar = (lista: Butaca[]) => {
      const b = lista.find(item => item.numero === numero);
      if (b) {
        b.ocupada = true;
        b.seleccionada = false;
      }
    };

    buscarYMarcar(filaTarget.bloqueIzquierdo);
    buscarYMarcar(filaTarget.bloqueCentro);
    buscarYMarcar(filaTarget.bloqueDerecho);

    // Si el usuario la tenía seleccionada, removerla
    this.butacasSeleccionadas.set(
      this.butacasSeleccionadas().filter(b => !(b.fila === fila && b.numero === numero))
    );

    this.mapaFilas.set(filas);
  }

  // Confirmar butacas y pasar al carrito unificado
  confirmarYContinuar() {
    const funcion = this.funcionSeleccionada();
    if (!funcion || this.butacasSeleccionadas().length === 0) return;

    const entradasParaCarrito = this.butacasSeleccionadas().map(b => ({
      funcion,
      butaca: b
    }));

    this.cartService.setEntradas(entradasParaCarrito);
    this.router.navigate(['/candy']);
  }

  // Enviar reseña
  async enviarResena() {
    const p = this.pelicula();
    const texto = this.nuevoComentario().trim();
    if (!p || !texto) return;

    try {
      this.enviandoResena.set(true);
      const usuario = this.authService.currentUserData();
      const nueva = await this.peliculaService.agregarReseña({
        pelicula_id: p.id,
        usuario_id: usuario?.id,
        nombre_usuario: usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Espectador Anónimo',
        calificacion: this.nuevaCalificacion(),
        comentario: texto
      });

      this.resenas.set([nueva, ...this.resenas()]);
      this.nuevoComentario.set('');
    } catch (err) {
      console.error('Error al publicar reseña:', err);
    } finally {
      this.enviandoResena.set(false);
    }
  }
}
