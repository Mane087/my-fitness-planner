# ADR 0002: Modelo de entrenamiento estructurado unificado para todos los deportes

Estado: aceptado · Fecha: 2026-09-27

## Contexto

El modelo inicial estaba acoplado a ciclismo: `WorkoutDiscipline` (road, mtb, indoor), categorías de ciclismo en `WorkoutType`, bloques planos con cadencia y zona de frecuencia cardiaca, y un solo juego de zonas. El objetivo del producto es planificar como en TrainingPeaks para ciclismo, running, movilidad y pliometría, y después gym y basquetbol. Eso exige expresar repeticiones (`3 × [5' Z4 + 2' Z1]`), series y repeticiones con carga y descanso, y objetivos de intensidad por frecuencia cardiaca, potencia, ritmo o RPE.

## Decisión

Un solo modelo de entrenamiento para todos los deportes, descrito en [domain-model.md](../domain-model.md):

- Un entrenamiento es una lista ordenada de pasos (`WorkoutStep`).
- Hay tres tipos de paso discriminados por `kind`: `interval` (tiempo, distancia o abierto, con objetivo de intensidad opcional), `exercise` (series × repeticiones, carga, descanso) y `repeat` (N × lista de pasos, un solo nivel de anidación).
- El objetivo de intensidad (`IntensityTarget`) es un tipo discriminado por métrica: `heart_rate`, `power` y `pace` referencian una zona y guardan su snapshot; `rpe` guarda un valor 1-10.
- Las zonas se agrupan en conjuntos por combinación de deporte y métrica (`TrainingZoneSetEntity`), cada uno con su valor de referencia (FC máxima, FTP, ritmo umbral).
- Plantillas y entrenamientos programados comparten `WorkoutDefinition`. El entrenamiento programado agrega fecha, estado y un registro de ejecución (`WorkoutCompletion`) opcional.
- Las unidades internas son segundos, metros y segundos por kilómetro; la UI convierte.
- Agregar un deporte consiste en agregar el valor a `Sport`, sus categorías permitidas, sus modalidades y, si usa zonas, su tabla de semillas. No requiere entidades ni pantallas nuevas.

## Alternativas consideradas

- **Extender el bloque plano actual** con campos `sport`, `sets`, `reps`, `load`, `rest`. Cambio pequeño y sin migración compleja, pero sin grupos de repetición: un `6 × (3' + 3')` se captura como doce bloques y los campos de un deporte quedan vacíos en los demás. Se descartó porque no cumple el objetivo del producto.
- **Una entidad por deporte** (`CyclingWorkout`, `RunningWorkout`, `StrengthWorkout`). Muy explícito, pero el calendario, la biblioteca, el resumen semanal, el respaldo y las migraciones tendrían que manejar N tipos, y cada deporte nuevo repetiría todo ese trabajo. Se descartó por costo de mantenimiento.

## Consecuencias

- Un solo calendario, un solo editor, una sola biblioteca y un solo resumen para todos los deportes.
- Los datos guardados con el esquema v1 deben migrarse (bloques planos a pasos `interval`, zonas a un conjunto de ciclismo/FC). La migración se prueba con un fixture v1 real.
- La anidación de repeticiones se limita a un nivel para simplificar el editor y el cálculo de totales. El esquema puede relajarse sin migrar datos si aparece un caso real que lo necesite.
- El snapshot de zona dentro del paso hace que el historial no cambie cuando el usuario recalcula sus zonas.
- Cambiar tipos derivados afecta a todos los archivos que importan el dominio; el cambio se hace en un solo issue para no dejar el proyecto en un estado intermedio.

## Cuándo revisar

- Aparece una sesión real que necesite repeticiones anidadas.
- Gym o basquetbol requieren un catálogo de ejercicios reutilizable (nombres, grupos musculares, progresiones); en ese momento se evalúa una entidad `Exercise` referenciada por `ExerciseStep`.
- Se importan archivos de dispositivos: las actividades registradas serían un subsistema separado de la planificación.
