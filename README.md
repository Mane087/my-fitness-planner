# MyFitnessPlanner

Planificador y registro de entrenamientos estructurados, al estilo de TrainingPeaks: un calendario con entrenamientos compuestos por intervalos, series, repeticiones y objetivos de intensidad, y una biblioteca de plantillas reutilizables.

La aplicación funciona sin backend: todos los datos se guardan en IndexedDB del navegador y pueden exportarse e importarse como respaldo en JSON.

## Deportes

Fase 1:

- Ciclismo (ruta, MTB, gravel, indoor)
- Running (ruta, trail, pista, caminadora)
- Movilidad
- Pliometría

Fase 2: gym y basquetbol.

## Métricas de intensidad

- Frecuencia cardiaca (zonas a partir de la FC máxima)
- Potencia (zonas a partir del FTP)
- Ritmo (zonas a partir del ritmo umbral)
- RPE (esfuerzo percibido 1-10)

## Tecnologías

- Angular 22
- Tailwind CSS 4
- Zod 4
- TypeScript 6
- Jest (pruebas unitarias e integración) y Playwright (end-to-end)
- pnpm

## Comandos

```bash
pnpm install          # instalar dependencias
pnpm start            # servidor de desarrollo en http://localhost:4200
pnpm build            # build de producción
pnpm lint             # ESLint
pnpm test             # pruebas unitarias e integración
pnpm test:watch       # pruebas en modo watch
pnpm test:coverage    # pruebas con cobertura
pnpm e2e              # pruebas end-to-end con Playwright
```

## Documentación

- [docs/architecture.md](./docs/architecture.md): capas, reglas de dependencia, migraciones y pruebas.
- [docs/domain-model.md](./docs/domain-model.md): entidades, enums, unidades y ejemplos de entrenamientos estructurados.
- [docs/adr/](./docs/adr/): registros de decisiones de arquitectura.
- [AGENTS.md](./AGENTS.md): convenciones de código y seguridad.

## Contribuir

Ver [CONTRIBUTING.md](./CONTRIBUTING.md). Resumen: una rama por issue (`<número>-<tipo>-<descripción>`), commits convencionales y PR con la plantilla del repositorio.
