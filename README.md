# 🎬 CinemaApp PWA - Sistema Integral de Gestión y Venta de Entradas

> **Trabajo Práctico Integrador 1 — Programación IV (2026 C2)**  
> **Alumno:** Santiago Gemignani  
> **Docente:** Manuel Quintana  

---

## 📌 Descripción del Proyecto
**CinemaApp PWA** es una aplicación web progresiva moderna, responsiva y de alto rendimiento desarrollada en **Angular 19+** con backend serverless en **Supabase**. Permite a los espectadores consultar la cartelera en tiempo real, reservar butacas interactivas con sincronización multiusuario inmediata, comprar combos de Candy Bar en un carrito unificado, canjear puntos de fidelización y obtener sus entradas digitales con código QR dinámico y comprobante en PDF. Además, cuenta con un módulo de validación para empleados y un panel integral de administración.

---

## 🚀 Arquitectura y Tecnologías

### Frontend (Angular 19+)
- **Standalone Components & Modular Routing:** Componentes modernos sin `NgModule`, con carga perezosa (`lazy loading`) por rutas.
- **Angular Signals:** Gestión del estado ultra-reactivo mediante `signal()`, `computed()` y `effect()`.
- **Functional Route Guards:** Control de acceso basado en roles (`authGuard`, `adminGuard`, `empleadoGuard`) usando la función `inject()`.
- **Directivas Estructurales Personalizadas:** Directiva `*appRole` para renderizado condicional según el rol del usuario.
- **Generación de Entradas:** Códigos QR dinámicos generados con `qrcode` y tickets digitales exportados del lado del cliente con `jspdf`.

### Backend & Persistencia (Supabase)
- **PostgreSQL Relacional:** Esquema normalizado para usuarios, salas, películas, funciones, compras, entradas, cupones, auditoría y candy bar.
- **Row Level Security (RLS):** Políticas de seguridad a nivel de fila para aislamiento de datos entre clientes, empleados y administradores.
- **Supabase Realtime:** WebSockets nativos de PostgreSQL para reflejar butacas ocupadas en vivo entre múltiples clientes simultáneos.
- **Autenticación JWT:** Registro de clientes con campos de perfil requeridos (tipo de sangre, color de ojos, días de vacaciones por año y fecha de nacimiento).

---

## 🏛️ Reglas de Negocio Implementadas

1. **Distribución Física Inmutable de Salas:**
   - Cada sala cuenta con **20 filas numeradas de la A a la T**.
   - Distribución en 3 columnas: **4, 20 y 4 butacas** (total estándar de 28 butacas por fila).
   - **Filas J y K (Accesibilidad):** Exclusivas para personas con movilidad reducida con distribución adaptada de **2, 10 y 2 butacas**.
   - **Filas R, S y T (Categoría VIP):** Resaltadas con distintivo dorado y recargo de tarifa.
2. **Sincronización en Tiempo Real:**
   - La selección y compra de butacas se propaga instantáneamente a todos los navegadores conectados mediante canales de Supabase Realtime.
3. **Checkout Unificado (Entradas + Candy Bar):**
   - Compra conjunta de entradas y combos especiales en una única transacción.
   - Posibilidad de comprar como **usuario registrado** o como **invitado / anónimo**.
   - Cupón automático del **20% de bienvenida** en la primera compra (`BIENVENIDA20`).
   - Cupón exclusivo para clientes **mayores de 50 años** (`MAYORES50`).
   - Reintegro y uso de **saldo de crédito en cuenta**.
4. **QR Unificado e Intransferible:**
   - Un único código QR (`CIN-XXXXXXXX`) y alfanumérico permite validar tanto el ingreso a la sala de cine como el retiro de snacks en el Candy Bar.
   - Cada sector se invalida independientemente tras su uso.
5. **Módulo de Validación para Empleados (`/validador`):**
   - Validación mediante escáner QR o ingreso manual del código con teclado.
   - Registro automático en el log de auditoría.
6. **Política de Cancelaciones:**
   - Los clientes pueden cancelar sus compras hasta **2 horas antes** del inicio de la función.
   - Reembolso 100% como **crédito en cuenta** y liberación inmediata de butacas.

---

## 🗺️ Estado del Cronograma de Hitos

- [x] **Hito 1 (Semana 3):** Requerimientos aprobados, modelo relacional en Supabase con RLS y estructura base en Angular 19.
- [x] **Hito 2 (Semana 7):** Catálogo de cartelera, buscador multigénero, módulo de preventa y mapa interactivo de butacas con Realtime.
- [x] **Hito 3 (Semana 11):** Checkout unificado (entradas + candy bar), generación de PDF con QR dinámico y módulo de validación para empleados.
- [ ] **Hito 4 (Semana 15):** Panel de administración completo con asignación automática de salas (sin solapamientos y buffer de 30 min), reportes exportables a PDF/Excel, auditoría y módulo Mis Películas.
- [ ] **Hito 5 (Semana 20):** Despliegue en producción con soporte PWA, URL funcional, repositorio GitHub documentado y defensa oral.

---


   npm start
   # o bien: ng serve
   ```
   Abrir navegador en `http://localhost:4200/`.

---
*Desarrollado con dedicación para Programación IV.*
