import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.HomeComponent)
  },
  {
    path: 'pelicula/:id',
    loadComponent: () => import('./features/pelicula-detalle/pelicula-detalle').then(m => m.PeliculaDetalleComponent)
  },
  {
    path: 'candy',
    loadComponent: () => import('./features/candy/candy').then(m => m.CandyComponent)
  },
  {
    path: 'checkout',
    loadComponent: () => import('./features/checkout/checkout').then(m => m.CheckoutComponent)
  },
  {
    path: 'validador',
    loadComponent: () => import('./features/validador/validador').then(m => m.ValidadorComponent)
  },
  {
    path: 'proximamente',
    loadComponent: () => import('./features/proximamente/proximamente').then(m => m.ProximamenteComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'registro',
    loadComponent: () => import('./features/auth/register/register').then(m => m.RegisterComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
