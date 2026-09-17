import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  cargando = signal<boolean>(false);
  errorMsg = signal<string | null>(null);
  registroExitoso = signal<boolean>(false);

  // Opciones para tipos de sangre y colores de ojos
  tiposSangre = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  coloresOjos = ['Marrones', 'Azules', 'Verdes', 'Negros', 'Miel / Avellana', 'Grises'];

  // Reactive Form con todos los campos exactos pedidos en la consigna
  form = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
    apellido: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    fecha_nacimiento: new FormControl('', [Validators.required]),
    tipo_sangre: new FormControl('O+', [Validators.required]),
    color_ojos: new FormControl('Marrones', [Validators.required]),
    dias_vacaciones: new FormControl<number>(14, [Validators.required, Validators.min(0), Validators.max(90)])
  });

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      this.cargando.set(true);
      this.errorMsg.set(null);

      const val = this.form.value;
      const { error } = await this.authService.register(
        val.email!,
        val.password!,
        {
          nombre: val.nombre!,
          apellido: val.apellido!,
          fecha_nacimiento: val.fecha_nacimiento!,
          tipo_sangre: val.tipo_sangre!,
          color_ojos: val.color_ojos!,
          dias_vacaciones: Number(val.dias_vacaciones || 0)
        }
      );

      if (error) {
        this.errorMsg.set(error.message);
        return;
      }

      this.registroExitoso.set(true);
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 2000);
    } catch (err: any) {
      this.errorMsg.set('Ocurrió un error inesperado: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }
}
