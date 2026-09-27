# Documentación

Documentación técnica de MyFitnessPlanner. Describe el modelo objetivo (v2) del sistema, no necesariamente el estado actual del código; cada issue del roadmap referencia estos documentos como su especificación.

## Documentos

- [Arquitectura](./architecture.md): capas de la aplicación, reglas de dependencia y flujo de datos.
- [Modelo de dominio](./domain-model.md): entidades, enums, unidades y ejemplos de entrenamientos estructurados.

## Registros de decisiones de arquitectura (ADR)

| ADR                                                   | Decisión                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| [0001](./adr/0001-local-first-indexeddb.md)           | Persistencia local en IndexedDB con respaldo manual en JSON            |
| [0002](./adr/0002-unified-structured-workout.md)      | Modelo de entrenamiento estructurado unificado para todos los deportes |
| [0003](./adr/0003-zod-as-single-validation-source.md) | Zod como única fuente de tipos y validación del dominio                |
| [0004](./adr/0004-ui-language-spanish.md)             | Interfaz en español, código en inglés, sin infraestructura i18n        |

## Convenciones de los ADR

Cada ADR tiene las secciones: Contexto, Decisión, Alternativas consideradas, Consecuencias y Cuándo revisar. Un ADR no se edita para cambiar la decisión; se crea uno nuevo que lo reemplaza y se marca el anterior como reemplazado.
