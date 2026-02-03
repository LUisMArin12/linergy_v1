# LINERGY (Vite + React + TypeScript)

Proyecto web para visualización y gestión de líneas, estructuras, subestaciones y fallas, con mapa (Leaflet) y reportes.

## Cambios realizados (resumen)

### Lint / TypeScript
- Se bajó **TypeScript a 5.5.4** para evitar el warning de compatibilidad con `@typescript-eslint/typescript-estree`.
- Se eliminaron todos los usos de `any` (se reemplazaron por tipos concretos o `unknown` + type guards).
- Se corrigieron violaciones de **Rules of Hooks** (hooks condicionales) en `DetailPanel.tsx`.
- Se corrigieron imports/variables sin uso.
- Se atendieron warnings de `react-refresh/only-export-components` con anotaciones explícitas en context hooks.

### Tipado Geo
- Se añadieron tipos GeoJSON mínimos en `src/types/geo.ts` (`Point`, `LineString`, `MultiLineString`) y guards.

### Mejoras de performance / UX
- **Code-splitting** por rutas: páginas pesadas (`MapPage`, `ReportsPage`, admin, settings) se cargan con `React.lazy()` + `Suspense`.
- `LeafletMap` se refactorizó para no duplicar capas: se usa un `LayerGroup` contenedor y se limpia por render.

## Requisitos
- Node.js 18+ recomendado.

## Instalación
```bash
npm install
```

## Desarrollo
```bash
npm run dev
```

## Lint
```bash
npm run lint
```

## Build
```bash
npm run build
npm run preview
```

## Notas importantes
- Las Edge Functions de Supabase (`supabase/functions/*`) fueron tipadas sin `any` usando `unknown` y validaciones.
- `parseGeometry` soporta GeoJSON serializado y WKT básico (POINT / LINESTRING).
