import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TitleCasePipe, UpperCasePipe } from '@angular/common';
import { CandyService } from '../../core/services/candy.service';
import { CartService } from '../../core/services/cart.service';
import { ProductoCandy, ComboEspecial, CategoriaCandy } from '../../core/models/candy.interface';

@Component({
  selector: 'app-candy',
  standalone: true,
  imports: [RouterLink, TitleCasePipe, UpperCasePipe],
  templateUrl: './candy.html',
  styleUrl: './candy.css'
})
export class CandyComponent implements OnInit {
  private candyService = inject(CandyService);
  cartService = inject(CartService);

  productos = signal<ProductoCandy[]>([]);
  combos = signal<ComboEspecial[]>([]);
  cargando = signal<boolean>(true);
  categoriaSeleccionada = signal<string>('Todos');

  categorias = ['Todos', 'pochoclos', 'bebidas', 'golosinas'];

  productosFiltrados = computed(() => {
    const cat = this.categoriaSeleccionada();
    if (cat === 'Todos') {
      return this.productos();
    }
    return this.productos().filter(p => p.categoria === cat);
  });

  async ngOnInit() {
    try {
      this.cargando.set(true);
      const [prods, cmbs] = await Promise.all([
        this.candyService.getProductos(),
        this.candyService.getCombos()
      ]);
      this.productos.set(prods);
      this.combos.set(cmbs);
    } catch (err) {
      console.error('Error al cargar Candy Bar:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  setCategoria(cat: string) {
    this.categoriaSeleccionada.set(cat);
  }

  getCantidadEnCarrito(productoId: number): number {
    const item = this.cartService.candyItems().find(i => i.producto.id === productoId);
    return item ? item.cantidad : 0;
  }

  getComboCantidadEnCarrito(comboId: number): number {
    const item = this.cartService.comboItems().find(i => i.combo.id === comboId);
    return item ? item.cantidad : 0;
  }
}
