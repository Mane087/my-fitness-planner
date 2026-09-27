# ADR 0001: Persistencia local en IndexedDB con respaldo manual en JSON

Estado: aceptado · Fecha: 2026-09-27

## Contexto

La aplicación es de un solo usuario que planifica y registra sus propios entrenamientos. Desde el primer issue los datos se guardan en IndexedDB del navegador y no existe backend. Al definir las bases del sistema multideporte había que decidir si mantener ese modelo, prepararlo para sincronización futura o agregar un backend desde ahora, porque la elección afecta identificadores, metadatos de las entidades y la estrategia de migraciones.

## Decisión

La aplicación sigue siendo local-first sin backend:

- Todos los datos viven en IndexedDB (`cycling_training_planner_db`), accedida solo desde la capa `storage`.
- Los identificadores son UUID v4 generados en el cliente y cada entidad lleva `createdAt` y `updatedAt` en ISO 8601.
- El esquema se versiona con `INDEXED_DB_VERSION` y una lista ordenada de migraciones que transforman datos dentro de la transacción `versionchange`.
- El usuario puede exportar toda la base a un archivo JSON con `schemaVersion` e importarlo en otro navegador. La importación valida el archivo, reemplaza todos los stores en una sola transacción y solo acepta la versión de esquema actual.

## Alternativas consideradas

- **Local ahora, backend y multi-dispositivo en fase 2.** Implica agregar desde ya `version`, `deletedAt` y `ownerId` a cada entidad y un puerto de repositorio intercambiable. Se descartó porque no hay un requisito real de sincronización; sería diseño especulativo con costo en cada entidad y cada prueba.
- **Backend desde el inicio.** Cambia el alcance del proyecto (API, autenticación, despliegue) y no resuelve ningún problema actual.

## Consecuencias

- Sin costo de operación ni de infraestructura; la aplicación funciona sin conexión.
- El riesgo principal es la pérdida de datos al borrar el almacenamiento del navegador. El respaldo manual lo mitiga y por eso es parte de la fase 0 del roadmap.
- Cada cambio de modelo requiere una migración de datos probada, porque no hay un servidor que pueda reprocesar la información.
- No hay uso en varios dispositivos ni colaboración con un entrenador.

## Cuándo revisar

- Se decide sincronizar entre dispositivos o compartir el plan con otra persona: agregar metadatos de sincronización a las entidades y un puerto de repositorio que permita sustituir IndexedDB por una API.
- El volumen de datos supera lo razonable para exportar en un solo JSON (miles de entrenamientos con estructura detallada).
