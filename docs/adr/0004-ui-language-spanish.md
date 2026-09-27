# ADR 0004: Interfaz en español, código en inglés, sin infraestructura i18n

Estado: aceptado · Fecha: 2026-09-27

## Contexto

La interfaz tenía textos mezclados: la página de inicio en inglés y los formularios, el calendario y los mensajes de validación en español. `AGENTS.md` establece que el código se mantiene en inglés, pero no definía el idioma de la interfaz. Con el modelo v2 se agregan varias pantallas nuevas y había que fijar una regla antes de escribirlas.

## Decisión

- Todo el texto visible para el usuario se escribe en español: etiquetas, botones, mensajes de validación, estados vacíos, errores y documentación en `docs/`.
- El código sigue en inglés: identificadores, nombres de archivo, comentarios, valores de enums y mensajes de excepción internos.
- No se agrega infraestructura de internacionalización (`@angular/localize` ni diccionarios propios). Los textos van directamente en las plantillas y en el mapa de errores de Zod.
- Los valores de los enums (`cycling`, `heart_rate`) se traducen a etiquetas con constantes `*_LABELS` en la capa de UI, no en el dominio.

## Alternativas consideradas

- **Interfaz en inglés.** Coherente con el código, pero el usuario del sistema trabaja en español.
- **Ambos idiomas con i18n desde ahora.** Cada pantalla nueva costaría el doble de textos y se agregaría un proceso de extracción y compilación por idioma sin un usuario que lo necesite.

## Consecuencias

- Menos trabajo por pantalla y una sola fuente para cada texto.
- Los mensajes de dominio en español quedan en `zod-error-map.ts`; las excepciones internas de servicios y repositorios se mantienen en inglés porque no se muestran al usuario.
- Cambiar de idioma después implicaría extraer todos los textos; es una migración mecánica y acotada.

## Cuándo revisar

- Aparece un usuario que necesita otro idioma.
- Se publica la aplicación para terceros.
