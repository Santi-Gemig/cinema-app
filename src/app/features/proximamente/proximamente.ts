import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculaService } from '../../core/services/pelicula.service';
import { Pelicula } from '../../core/models/pelicula.interface';

@Component({
  selector: 'app-proximamente',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './proximamente.html',
  styleUrl: './proximamente.css'
})
export class ProximamenteComponent implements OnInit {
  private peliculaService = inject(PeliculaService);

  peliculas = signal<Pelicula[]>([]);
  cargando = signal<boolean>(true);
  alertas = signal<number[]>([]);
  feedbackMensaje = signal<string | null>(null);

  async ngOnInit() {
    try {
      this.cargando.set(true);
      // Cargar alertas guardadas localmente
      const saved = localStorage.getItem('alertas_estrenos');
      if (saved) {
        this.alertas.set(JSON.parse(saved));
      }

      const lista = await this.peliculaService.getProximamente();
      this.peliculas.set(lista);
    } catch (err) {
      console.error('Error al cargar próximos estrenos:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  // Activar o desactivar recordatorio de estreno
  toggleAlerta(pelicula: Pelicula) {
    const actuales = [...this.alertas()];
    const index = actuales.indexOf(pelicula.id);

    if (index > -1) {
      actuales.splice(index, 1);
      this.feedbackMensaje.set(`Alerta desactivada para ${pelicula.titulo}`);
    } else {
      actuales.push(pelicula.id);
      this.feedbackMensaje.set(`🔔 ¡Listo! Te notificaremos cuando salgan las entradas de ${pelicula.titulo}.`);
    }

    this.alertas.set(actuales);
    localStorage.setItem('alertas_estrenos', JSON.stringify(actuales));

    setTimeout(() => {
      this.feedbackMensaje.set(null);
    }, 4000);
  }

  tieneAlerta(peliculaId: number): boolean {
    return this.alertas().includes(peliculaId);
  }
}
