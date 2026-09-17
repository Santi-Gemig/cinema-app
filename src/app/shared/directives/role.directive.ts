import { Directive, effect, inject, Input, signal, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

/**
 * Directiva estructural personalizada para control de roles basada en Signals
 * Uso: <div *appRole="'admin'">Solo visible para administradores</div>
 *      <div *appRole="'empleado'">Visible para empleados y admins</div>
 */
@Directive({
  selector: '[appRole]',
  standalone: true
})
export class RoleDirective {
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthService);

  private expectedRole = signal<string | null>(null);

  @Input() set appRole(role: string) {
    this.expectedRole.set(role);
  }

  constructor() {
    effect(() => {
      const userRole = this.authService.rol();
      const targetRole = this.expectedRole();

      let hasPermission = false;
      if (targetRole === 'admin') {
        hasPermission = userRole === 'admin';
      } else if (targetRole === 'empleado') {
        hasPermission = userRole === 'empleado' || userRole === 'admin';
      } else if (targetRole === 'cliente') {
        hasPermission = userRole === 'cliente';
      }

      if (hasPermission) {
        this.viewContainer.clear();
        this.viewContainer.createEmbeddedView(this.templateRef);
      } else {
        this.viewContainer.clear();
      }
    });
  }
}
