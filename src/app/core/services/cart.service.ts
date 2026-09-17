import { Injectable, signal, computed } from '@angular/core';
import { ProductoCandy, ComboEspecial } from '../models/candy.interface';
import { Butaca } from '../models/sala.interface';
import { Funcion } from '../models/funcion.interface';

export interface CartItemCandy {
  producto: ProductoCandy;
  cantidad: number;
}

export interface CartItemCombo {
  combo: ComboEspecial;
  cantidad: number;
}

export interface CartEntrada {
  funcion: Funcion;
  butaca: Butaca;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  // Signals para el carrito unificado
  entradas = signal<CartEntrada[]>([]);
  candyItems = signal<CartItemCandy[]>([]);
  comboItems = signal<CartItemCombo[]>([]);

  // Computeds reactivos
  totalEntradas = computed(() => this.entradas().length);
  
  totalCandyItems = computed(() => {
    const c = this.candyItems().reduce((acc, item) => acc + item.cantidad, 0);
    const cb = this.comboItems().reduce((acc, item) => acc + item.cantidad, 0);
    return c + cb;
  });

  totalItemsCount = computed(() => this.totalEntradas() + this.totalCandyItems());

  subtotalEntradas = computed(() => {
    return this.entradas().reduce((acc, e) => acc + e.butaca.precio, 0);
  });

  subtotalCandy = computed(() => {
    const c = this.candyItems().reduce((acc, i) => acc + (i.producto.precio * i.cantidad), 0);
    const cb = this.comboItems().reduce((acc, i) => acc + (i.combo.precio * i.cantidad), 0);
    return c + cb;
  });

  totalGeneral = computed(() => this.subtotalEntradas() + this.subtotalCandy());

  // Manejo de Candy Bar
  addCandy(producto: ProductoCandy) {
    const actual = this.candyItems();
    const index = actual.findIndex(i => i.producto.id === producto.id);
    if (index > -1) {
      const nuevo = [...actual];
      nuevo[index].cantidad += 1;
      this.candyItems.set(nuevo);
    } else {
      this.candyItems.set([...actual, { producto, cantidad: 1 }]);
    }
  }

  removeCandy(productoId: number) {
    const actual = this.candyItems();
    const index = actual.findIndex(i => i.producto.id === productoId);
    if (index > -1) {
      const nuevo = [...actual];
      if (nuevo[index].cantidad > 1) {
        nuevo[index].cantidad -= 1;
        this.candyItems.set(nuevo);
      } else {
        this.candyItems.set(actual.filter(i => i.producto.id !== productoId));
      }
    }
  }

  // Manejo de Combos
  addCombo(combo: ComboEspecial) {
    const actual = this.comboItems();
    const index = actual.findIndex(i => i.combo.id === combo.id);
    if (index > -1) {
      const nuevo = [...actual];
      nuevo[index].cantidad += 1;
      this.comboItems.set(nuevo);
    } else {
      this.comboItems.set([...actual, { combo, cantidad: 1 }]);
    }
  }

  removeCombo(comboId: number) {
    const actual = this.comboItems();
    const index = actual.findIndex(i => i.combo.id === comboId);
    if (index > -1) {
      const nuevo = [...actual];
      if (nuevo[index].cantidad > 1) {
        nuevo[index].cantidad -= 1;
        this.comboItems.set(nuevo);
      } else {
        this.comboItems.set(actual.filter(i => i.combo.id !== comboId));
      }
    }
  }

  // Entradas
  setEntradas(entradas: CartEntrada[]) {
    this.entradas.set(entradas);
  }

  clear() {
    this.entradas.set([]);
    this.candyItems.set([]);
    this.comboItems.set([]);
  }
}
