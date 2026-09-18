import { Component, inject, signal } from '@angular/core';
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

  menuAbierto = signal(false);

  toggleMenu() {
    this.menuAbierto.update(v => !v);
  }

  cerrarMenu() {
    this.menuAbierto.set(false);
  }

  async onLogout() {
    this.cerrarMenu();
    await this.authService.logout();
    this.router.navigate(['/']);
  }
}
