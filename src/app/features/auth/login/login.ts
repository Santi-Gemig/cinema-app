import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  cargando = signal<boolean>(false);
  errorMsg = signal<string | null>(null);

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)])
  });

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      this.cargando.set(true);
      this.errorMsg.set(null);

      const { email, password } = this.form.value;
      const { error } = await this.authService.login(email!, password!);

      if (error) {
        this.errorMsg.set(error.message === 'Invalid login credentials' 
          ? 'Email o contraseña incorrectos' 
          : error.message);
        return;
      }

      // Redirigir a la home
      this.router.navigate(['/']);
    } catch (err: any) {
      this.errorMsg.set('Error al iniciar sesión: ' + err.message);
    } finally {
      this.cargando.set(false);
    }
  }
}
