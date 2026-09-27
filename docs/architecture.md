# Arquitectura

MyFitnessPlanner es una aplicación web Angular de una sola página, local-first: todos los datos se guardan en IndexedDB del navegador y no existe backend (ver [ADR 0001](./adr/0001-local-first-indexeddb.md)).

## Stack

| Área                            | Tecnología                                                 |
| ------------------------------- | ---------------------------------------------------------- |
| Framework                       | Angular 22 (componentes standalone, signals, `OnPush`)     |
| Estilos                         | Tailwind CSS 4                                             |
| Validación y tipos de dominio   | Zod 4                                                      |
| Persistencia                    | IndexedDB (API nativa, sin librería intermedia)            |
| Pruebas unitarias e integración | Jest 30 + `jest-preset-angular` + `fake-indexeddb`         |
| Pruebas end-to-end              | Playwright                                                 |
| Calidad                         | ESLint, Prettier, Husky, commitlint (conventional commits) |
| Gestor de paquetes              | pnpm                                                       |

## Capas

```
src/app/
├── core/
│   ├── domain/          # Enums, esquemas Zod y tipos de las entidades
│   │   └── schemas/
│   ├── storage/         # Apertura de IndexedDB, migraciones, API genérica por store
│   │   └── migrations/
│   ├── repositories/    # Acceso a datos por entidad; validan con los esquemas antes de escribir
│   ├── services/        # Casos de uso y utilidades puras (calendario, resúmenes, respaldo, estructura)
│   └── models/          # View models y tipos exclusivos de la UI
├── layouts/             # App shell y modal
├── components/          # Componentes reutilizables (botones, inputs, select, tabla, editor de pasos)
└── pages/               # Una carpeta por ruta; cada página tiene su facade cuando orquesta varios servicios
```

### Reglas de dependencia

Las dependencias van en una sola dirección, de afuera hacia adentro:

```
pages / layouts / components
        │
        ▼
     services  ──►  repositories  ──►  storage
        │                 │
        └────────┬────────┘
                 ▼
              domain
```

- `domain` no importa nada de Angular ni de otras capas. Contiene enums, esquemas Zod y los tipos inferidos de ellos.
- `storage` conoce los nombres de los stores y las migraciones. No conoce reglas de negocio.
- `repositories` son la única capa que llama a `IndexedDbService`. Cada repositorio valida la entidad con su esquema (`schema.parse`) antes de escribir y devuelve entidades tipadas.
- `services` implementan casos de uso combinando repositorios y utilidades puras. No acceden a IndexedDB directamente.
- `pages` y `components` nunca importan `storage` ni llaman a `indexedDB`. Una página que combina varios servicios usa un facade (`*.facade.ts`) en su misma carpeta; el componente solo maneja estado de UI (signals) y eventos.
- `models` contiene tipos de UI (view models de calendario, valores de formulario). Los tipos de dominio se importan desde `domain`, no se duplican en `models`.

### Flujo de datos

1. La página se activa por ruta y pide datos a su facade o servicio.
2. El servicio consulta repositorios, que leen de IndexedDB y devuelven entidades.
3. El servicio transforma entidades en view models cuando la página lo necesita (etiquetas, formato de unidades).
4. La página muestra el view model y emite acciones (guardar, mover, completar).
5. El facade convierte el valor del formulario en una entidad, la valida con el esquema (`safeParse`) y delega al repositorio.
6. El repositorio valida de nuevo (`parse`) y escribe. La validación en dos puntos protege contra escrituras que no vienen de un formulario (respaldo, migraciones, plantillas).

## Inicialización

`LocalPersistenceService.initialize()` se ejecuta al arrancar la aplicación, con `provideAppInitializer` en `app.config.ts`:

1. Abre la base de datos y ejecuta las migraciones pendientes (`storage/indexed-db.migrations.ts`).
2. Crea la configuración de la aplicación si no existe.
3. Crea el perfil del atleta si no existe.
4. Siembra el conjunto de zonas de frecuencia cardiaca del deporte preferido si no existe. Si ese deporte no usa zonas (movilidad, pliometría), usa el de ciclismo.

Si la inicialización falla (por ejemplo, el navegador no permite IndexedDB), el error se registra en consola y la aplicación arranca de todos modos; cada página muestra su propio mensaje de error de almacenamiento.

### Primer uso

Como el perfil por defecto siempre existe después de la inicialización, la página de inicio decide a dónde enviar al usuario con `AthleteProfileRepository.hasConfiguredProfile()`: el perfil por defecto tiene `createdAt === updatedAt` hasta que el usuario lo guarda por primera vez. Sin perfil guardado, el botón "Ir al calendario" lleva a `/profile`; con perfil guardado, a `/calendar`.

## Navegación

`AppShellComponent` (`layouts/app-shell/`) envuelve todas las rutas con la barra de navegación principal: Calendario, Biblioteca y Perfil. La ruta `/library` usa `ComingSoonPageComponent` hasta que exista la biblioteca de plantillas (#17); el título llega por `data` de la ruta gracias a `withComponentInputBinding()`.

## Migraciones

`INDEXED_DB_VERSION` define la versión del esquema. `MIGRATIONS` es una lista ordenada de objetos `{ version, upgrade(database, transaction) }`. Al abrir la base con una versión mayor a la instalada, el navegador dispara `versionchange` y se ejecutan en orden todas las migraciones con `version > oldVersion`.

Reglas:

- Toda transformación de datos ocurre dentro de la transacción `versionchange` usando cursores. No se puede esperar (`await`) una promesa externa dentro de esa transacción.
- Una migración que falla aborta la transacción completa; la base queda en la versión anterior.
- Las migraciones no importan esquemas Zod ni repositorios: describen la forma antigua y la nueva de forma explícita para que sigan funcionando cuando el dominio cambie otra vez.
- Cada migración tiene una prueba con `fake-indexeddb` que parte de un fixture con datos de la versión anterior.

## Respaldo

`BackupService` exporta todos los stores en un archivo JSON con `schemaVersion` y `exportedAt`, y los importa validando el archivo con `backup.schema.ts`. La importación reemplaza todos los stores en una sola transacción; si falla, los datos actuales no cambian. Solo se aceptan respaldos de la versión de esquema actual.

## Pruebas

| Nivel       | Herramienta             | Qué cubre                                                                                                   |
| ----------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Unitarias   | Jest                    | Esquemas Zod, utilidades puras (`workout-structure.utils.ts`, fechas), servicios con repositorios simulados |
| Integración | Jest + `fake-indexeddb` | Repositorios, migraciones, respaldo                                                                         |
| End-to-end  | Playwright              | Flujos completos: crear entrenamiento estructurado, completar, biblioteca, respaldo                         |

Las pruebas viven en `src/**/*.spec.ts` (componentes) y `test/**/*.spec.ts` (servicios, repositorios, migraciones). Las e2e en `e2e/`.

## Convenciones

Ver [AGENTS.md](../AGENTS.md) para nombres, idioma del código y seguridad. Resumen:

- Código en inglés; interfaz y documentación en español ([ADR 0004](./adr/0004-ui-language-spanish.md)).
- Archivos y carpetas en `kebab-case`; clases en `PascalCase`; variables y funciones en `camelCase`; booleanos con prefijo `is`, `has`, `can`, `should`.
- Una rama por issue con el formato `<número>-<tipo>-<descripción>`; commits convencionales.
