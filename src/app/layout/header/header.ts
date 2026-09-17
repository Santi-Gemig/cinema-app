import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { RoleDirective } from '../../shared/directives/role.directive';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RoleDirective],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class HeaderComponent {
  authService = inject(AuthService);
  cartService = inject(CartService);
  private router = inject(Router);

  async alternarRol() {
    const roles: ('cliente' | 'empleado' | 'admin')[] = ['cliente', 'empleado', 'admin'];
    const actual = this.authService.rol() || 'cliente';
    const next = roles[(roles.indexOf(actual) + 1) % roles.length];
    await this.authService.cambiarRol(next);
  }

  async onLogout() {
    await this.authService.logout();
    this.router.navigate(['/']);
  }
}
