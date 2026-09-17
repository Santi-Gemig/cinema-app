import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { PeliculaService } from '../../core/services/pelicula.service';
import { Pelicula } from '../../core/models/pelicula.interface';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FormsModule, SlicePipe],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  private peliculaService = inject(PeliculaService);

  // Signals para el estado
  peliculas = signal<Pelicula[]>([]);
  top3 = signal<Pelicula[]>([]);
  cargando = signal<boolean>(true);
  errorMsg = signal<string | null>(null);

  // Filtros
  busqueda = signal<string>('');
  generoSeleccionado = signal<string>('Todos');

  // Géneros calculados a partir de las películas recibidas
  generos = computed(() => {
    const todos = new Set<string>();
    this.peliculas().forEach((p) => {
      p.generos?.forEach((g) => todos.add(g));
    });
    return ['Todos', ...Array.from(todos)];
  });

  // Películas filtradas reactivamente con computed
  peliculasFiltradas = computed(() => {
    const texto = this.busqueda().toLowerCase().trim();
    const genero = this.generoSeleccionado();

    return this.peliculas().filter((pelicula) => {
      const coincideTexto =
        !texto ||
        pelicula.titulo.toLowerCase().includes(texto) ||
        pelicula.sinopsis.toLowerCase().includes(texto);

      const coincideGenero =
        genero === 'Todos' || pelicula.generos?.includes(genero);

      return coincideTexto && coincideGenero;
    });
  });

  async ngOnInit() {
    try {
      this.cargando.set(true);
      const [cartelera, top] = await Promise.all([
        this.peliculaService.getCartelera(),
        this.peliculaService.getTop3Vendidas()
      ]);
      this.peliculas.set(cartelera);
      this.top3.set(top);
    } catch (err: any) {
      this.errorMsg.set('No se pudieron cargar las películas: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }

  setGenero(genero: string) {
    this.generoSeleccionado.set(genero);
  }
}
