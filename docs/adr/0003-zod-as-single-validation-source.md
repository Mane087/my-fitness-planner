# ADR 0003: Zod como única fuente de tipos y validación del dominio

Estado: aceptado · Fecha: 2026-09-27

## Contexto

Zod está instalado desde el inicio del proyecto pero no se usaba. La validación estaba duplicada a mano: los repositorios validaban con funciones en `repository-utils.ts` (mensajes en inglés) y el facade del formulario de sesión repetía las mismas reglas con mensajes en español. Cada regla nueva había que escribirla dos veces y las interfaces TypeScript podían desincronizarse de la validación. El modelo v2 agrega tipos discriminados (pasos, objetivos de intensidad, duraciones) y reglas cruzadas que hacen más costosa la duplicación.

## Decisión

- Cada entidad y cada tipo compuesto del dominio se define como un esquema Zod en `src/app/core/domain/schemas/`. El tipo TypeScript se infiere con `z.infer`; no se escriben interfaces paralelas.
- Las reglas cruzadas se expresan en el esquema con `superRefine` (distancia mayor que cero cuando el tipo es `distance`, `cadenceRpm.min <= max`, repetición no vacía, categoría permitida para el deporte, `zoneSnapshot.metric === target.metric`, `completion` presente si y solo si `status === 'completed'`).
- Los repositorios ejecutan `schema.parse()` antes de escribir. Es la última barrera y cubre escrituras que no vienen de un formulario (respaldo, plantillas, migraciones futuras).
- Los facades de formulario ejecutan `schema.safeParse()` y convierten `issues` en errores por campo para la UI.
- Los mensajes se definen una sola vez en un mapa de errores en español (`zod-error-map.ts`) registrado en `main.ts`. Los formularios muestran esos mensajes directamente.
- El formato de respaldo también es un esquema (`backup.schema.ts`).

## Alternativas consideradas

- **Mantener interfaces TypeScript y validación manual.** Sin dependencia adicional, pero con duplicación creciente y sin garantía de que interfaz y validación coincidan.
- **Validar solo en los formularios con `Validators` de Angular.** Deja sin protección las escrituras que no pasan por un formulario y acopla las reglas de dominio a la UI.
- **Otra librería de esquemas (Valibot, ArkType).** Zod ya está instalado, es la más extendida y su API de tipos discriminados cubre el modelo. No hay un motivo para cambiar.

## Consecuencias

- Una regla se escribe una vez y aplica en repositorios y formularios.
- Los tipos de dominio siempre coinciden con lo que se valida.
- Los mensajes de error de dominio son en español por diseño; el código y los nombres de campo siguen en inglés.
- Las migraciones no usan los esquemas: describen la forma antigua y la nueva de forma explícita para no romperse cuando el dominio cambie otra vez.
- Las pruebas de esquemas cubren casos válidos e inválidos y verifican el mensaje en español.

## Cuándo revisar

- El tamaño del bundle de Zod se vuelve relevante (se puede evaluar `zod/mini`).
- Se necesita validar en un backend con otro lenguaje; en ese caso se evalúa generar JSON Schema desde los esquemas.
