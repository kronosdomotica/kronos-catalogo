# KRONOS · Catálogo Digital V40

Catálogo dinámico de productos domóticos para venta a minoristas.  
Desplegado en Vercel — 100% frontend estático, sin backend.

## Páginas

| Página | Descripción |
|---|---|
| `/` | Catálogo principal con búsqueda, filtros y carrito |
| `/soluciones` | Bundles prediseñados por ambiente |
| `/marcas` | Catálogo por marca |
| `/carrito` | Carrito de compra |
| `/cuenta` | Perfil del cliente |
| `/pedidos` | Solicitudes registradas |
| `/pagos` | Estado de pagos |
| `/seguimiento` | Tracking de entrega |
| `/panel_operador` | Panel interno de gestión |

## Funcionalidades V40

- 150 productos en 15 familias domóticas
- Búsqueda en tiempo real + filtros por familia y marca
- Comparador de hasta 3 productos side-by-side
- Wishlist con drawer lateral
- Soluciones: 6 bundles prediseñados por ambiente
- Carrito y wishlist persistentes (localStorage)
- Ficha de producto con galería SVG y especificaciones
- Panel operador para gestión de solicitudes

## Deploy

```
Editar en:   Catalogo_Web\KRONOS_V40_CATALOGO_DINAMICO\
Correr:      copy_catalog_now.bat
Luego:       GitHub Desktop → commit + push
Auto-deploy: Vercel → https://kronos-catalogo.vercel.app
```

## Stack

HTML · CSS · JavaScript vanilla · localStorage · SVG assets
