import { Directive, ElementRef, HostListener, Input, Renderer2, inject } from '@angular/core';

/**
 * Directiva de atributo personalizada para manipulación segura del DOM con Renderer2
 * (Arquitectura enseñada en la Clase 6 de Programación IV)
 * Uso: <div appResaltar [colorResaltado]="'rgba(245, 197, 24, 0.2)'">...</div>
 */
@Directive({
  selector: '[appResaltar]',
  standalone: true
})
export class ResaltarDirective {
  private el = inject(ElementRef);
  private renderer = inject(Renderer2);

  @Input() colorResaltado = 'rgba(229, 9, 20, 0.15)';
  @Input() escalaHover = '1.02';

  @HostListener('mouseenter') onMouseEnter() {
    this.aplicarEfecto(true);
  }

  @HostListener('mouseleave') onMouseLeave() {
    this.aplicarEfecto(false);
  }

  private aplicarEfecto(activo: boolean) {
    // Uso de Renderer2 para manipulación segura del DOM sin riesgo de XSS (Clase 6)
    if (activo) {
      this.renderer.setStyle(this.el.nativeElement, 'boxShadow', `0 8px 24px ${this.colorResaltado}`);
      this.renderer.setStyle(this.el.nativeElement, 'transform', `translateY(-3px) scale(${this.escalaHover})`);
      this.renderer.setStyle(this.el.nativeElement, 'transition', 'all 0.25s ease');
    } else {
      this.renderer.removeStyle(this.el.nativeElement, 'boxShadow');
      this.renderer.removeStyle(this.el.nativeElement, 'transform');
    }
  }
}
