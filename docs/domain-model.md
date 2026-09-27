# Modelo de dominio

Este documento describe el modelo objetivo (esquema v2). Las decisiones de fondo están en [ADR 0002](./adr/0002-unified-structured-workout.md) y [ADR 0003](./adr/0003-zod-as-single-validation-source.md).

Todos los tipos se definen como esquemas Zod en `src/app/core/domain/schemas/` y se exportan junto con su tipo inferido (`z.infer`). Los identificadores son UUID v4 y las fechas de auditoría (`createdAt`, `updatedAt`) son cadenas ISO 8601.

## Unidades

| Magnitud            | Unidad interna                   | Presentación en UI |
| ------------------- | -------------------------------- | ------------------ |
| Tiempo              | segundos (entero)                | `mm:ss` o `h:mm`   |
| Distancia           | metros (entero)                  | km con un decimal  |
| Ritmo (running)     | segundos por kilómetro (entero)  | `mm:ss /km`        |
| Potencia            | watts (entero)                   | W                  |
| Frecuencia cardiaca | latidos por minuto (entero)      | bpm                |
| Carga               | kilogramos (decimal)             | kg                 |
| Cadencia            | revoluciones por minuto (entero) | rpm                |

Las conversiones viven en la capa de UI. Las entidades nunca guardan minutos, kilómetros ni cadenas de ritmo.

## Enums

```ts
Sport            = 'cycling' | 'running' | 'mobility' | 'plyometrics'   // fase 2: 'strength' | 'basketball'
SportModality    = cycling: 'road' | 'mtb' | 'gravel' | 'indoor'
                   running: 'road' | 'trail' | 'track' | 'treadmill'
                   (mobility y plyometrics no tienen modalidad)
WorkoutCategory  = 'recovery' | 'endurance' | 'tempo' | 'threshold' | 'vo2max'
                 | 'technique' | 'strength' | 'power' | 'mobility' | 'free'
IntensityMetric  = 'heart_rate' | 'power' | 'pace' | 'rpe'
StepPhase        = 'warm_up' | 'active' | 'recovery' | 'rest' | 'cool_down'
WorkoutStatus    = 'planned' | 'completed' | 'skipped'
WeekStartsOn     = 'monday' | 'sunday'
```

`WORKOUT_CATEGORIES_BY_SPORT` define qué categorías admite cada deporte. Agregar un deporte consiste en agregar el valor a `Sport`, su lista de categorías, sus modalidades (si aplica) y, si usa zonas, su tabla de semillas.

| Deporte     | Categorías permitidas                                          | Métricas con zonas |
| ----------- | -------------------------------------------------------------- | ------------------ |
| cycling     | recovery, endurance, tempo, threshold, vo2max, technique, free | heart_rate, power  |
| running     | recovery, endurance, tempo, threshold, vo2max, technique, free | heart_rate, pace   |
| mobility    | mobility, recovery, free                                       | ninguna (solo RPE) |
| plyometrics | power, strength, technique, free                               | ninguna (solo RPE) |

## Estructura de un entrenamiento

Un entrenamiento es una lista ordenada de pasos. Hay tres tipos de paso, discriminados por `kind`:

```ts
StepDuration =
  | { type: 'time'; seconds: number }        // > 0
  | { type: 'distance'; meters: number }     // > 0
  | { type: 'open' }                         // sin duración fija; no suma al total

IntensityTarget =
  | { metric: 'heart_rate' | 'power' | 'pace'; zoneId: string; zoneSnapshot: TrainingZoneSnapshot }
  | { metric: 'rpe'; value: number }         // 1..10

IntervalStep = {
  id: string
  kind: 'interval'
  name: string
  phase: StepPhase
  duration: StepDuration
  target?: IntensityTarget
  cadenceRpm?: { min: number; max: number }  // min <= max
  notes?: string
}

ExerciseStep = {
  id: string
  kind: 'exercise'
  name: string
  sets: number                               // >= 1
  reps: number                               // >= 1
  loadKg?: number
  restSeconds?: number
  target?: { metric: 'rpe'; value: number }
  notes?: string
}

RepeatStep = {
  id: string
  kind: 'repeat'
  repetitions: number                        // >= 2
  steps: (IntervalStep | ExerciseStep)[]     // no vacío; no admite otro RepeatStep
}

WorkoutStep = IntervalStep | ExerciseStep | RepeatStep
```

Reglas:

- Un `RepeatStep` solo contiene intervalos y ejercicios: un único nivel de anidación.
- `zoneSnapshot.metric` debe coincidir con `target.metric`.
- `cadenceRpm` solo tiene sentido en ciclismo; el editor lo oculta en otros deportes, pero el esquema no lo prohíbe para no acoplar la validación a la UI.

### Definición compartida

Plantillas y entrenamientos programados comparten la misma definición:

```ts
WorkoutDefinition = {
  title: string
  sport: Sport
  modality?: SportModality
  category: WorkoutCategory                  // permitida para el deporte
  primaryMetric: IntensityMetric
  steps: WorkoutStep[]                       // no vacío
  plannedDurationSeconds: number             // calculado al guardar, editable
  plannedDistanceMeters?: number
  objective?: string
  description?: string
  notes?: string
}
```

`plannedDurationSeconds` y `plannedDistanceMeters` se calculan con `calculateWorkoutTotals(steps)` y se guardan denormalizados para que el calendario y los resúmenes no recorran la estructura. Reglas del cálculo:

- Intervalo `time`: suma `seconds`. Intervalo `distance`: suma `meters` a la distancia; no suma tiempo.
- Intervalo `open`: no suma nada.
- Ejercicio: estimación `sets × (reps × 3 s + restSeconds)`; no suma distancia.
- Repetición: suma de sus pasos multiplicada por `repetitions`.

El usuario puede sobrescribir `plannedDurationSeconds` cuando la estimación no aplica (por ejemplo, ejercicios con tiempo bajo tensión distinto).

## Entidades

### WorkoutTemplateEntity (store `workout_templates`)

```ts
WorkoutTemplateEntity = WorkoutDefinition & {
  id: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
}
```

Índices: `by_sport`, `by_is_archived`, `by_title`.

### ScheduledWorkoutEntity (store `scheduled_workouts`)

```ts
WorkoutCompletion = {
  completedAt: string                        // ISO 8601
  durationSeconds?: number
  distanceMeters?: number
  rpe?: number                               // 1..10
  feeling?: number                           // 1..5
  notes?: string
}

ScheduledWorkoutEntity = WorkoutDefinition & {
  id: string
  scheduledDate: string                      // 'YYYY-MM-DD'
  status: WorkoutStatus
  sourceTemplateId?: string
  completion?: WorkoutCompletion
  createdAt: string
  updatedAt: string
}
```

Regla: `status === 'completed'` si y solo si `completion` está presente.

Al programar una plantilla se copia su definición completa (`steps` incluidos) y se guarda `sourceTemplateId`. Editar la plantilla después no modifica los entrenamientos ya programados.

Índices: `by_scheduled_date`, `by_status`, `by_sport`.

### TrainingZoneSetEntity (store `training_zone_sets`)

Un conjunto de zonas por combinación de deporte y métrica.

```ts
TrainingZone = {
  id: string
  name: string
  description?: string
  minValue: number
  maxValue: number                           // > minValue
  sortOrder: number                          // 1..n, consecutivo
}

TrainingZoneSetEntity = {
  id: string
  sport: Sport
  metric: 'heart_rate' | 'power' | 'pace'
  referenceValue: number                     // FC máx (bpm) | FTP (W) | ritmo umbral (s/km)
  zones: TrainingZone[]                      // ordenadas, contiguas, sin traslape
  createdAt: string
  updatedAt: string
}

TrainingZoneSnapshot = {
  zoneSetId: string
  zoneId: string
  name: string
  metric: 'heart_rate' | 'power' | 'pace'
  minValue: number
  maxValue: number
}
```

Para `pace`, los valores son segundos por kilómetro: un número menor es un ritmo más rápido. La zona 1 (recuperación) tiene el `minValue` más alto. La UI presenta las zonas en el orden de intensidad, no en el orden numérico de los valores.

El snapshot se copia dentro del `IntensityTarget` al guardar un paso, de forma que el historial conserve los rangos vigentes en ese momento aunque el usuario recalcule sus zonas después.

Índice único: `by_sport_and_metric` sobre `[sport, metric]`.

Tablas de semillas (`training-zone-set.defaults.ts`):

| Métrica    | Zonas                                                            | Base                       |
| ---------- | ---------------------------------------------------------------- | -------------------------- |
| heart_rate | 5 (Z1 50-60 %, Z2 60-70 %, Z3 70-80 %, Z4 80-90 %, Z5 90-100 %)  | % de FC máxima             |
| power      | 7 (Coggan: 0-55, 55-75, 75-90, 90-105, 105-120, 120-150, >150 %) | % de FTP                   |
| pace       | 5 (Z1 >129 %, Z2 114-129 %, Z3 106-113 %, Z4 99-105 %, Z5 <99 %) | % del ritmo umbral en s/km |

### AthleteProfileEntity (store `athlete_profiles`)

```ts
AthleteProfileEntity = {
  id: string
  name: string
  weightKg?: number
  maxHeartRate: number                       // valor general para sembrar zonas de FC
  preferredSport: Sport
  preferredIntensityMetric: IntensityMetric
  weekStartsOn: WeekStartsOn
  createdAt: string
  updatedAt: string
}
```

Existe un solo perfil. FTP y ritmo umbral no viven aquí: son el `referenceValue` de cada conjunto de zonas.

### AppSettingsEntity (store `app_settings`)

```ts
AppSettingsEntity = {
  id: string
  calendarDefaultView: 'week' | 'month'
  weekStartsOn: WeekStartsOn
  timeFormat: '12h' | '24h'
  createdAt: string
  updatedAt: string
}
```

### Formato de respaldo

```ts
Backup = {
  schemaVersion: 2
  exportedAt: string
  stores: {
    scheduled_workouts: ScheduledWorkoutEntity[]
    workout_templates: WorkoutTemplateEntity[]
    training_zone_sets: TrainingZoneSetEntity[]
    athlete_profiles: AthleteProfileEntity[]
    app_settings: AppSettingsEntity[]
  }
}
```

## Ejemplos

### Ciclismo: 3 × (5' Z4 + 2' Z1)

```
Rodada con intervalos de umbral · cycling / road · threshold · primaryMetric: heart_rate

[interval]  Calentamiento   warm_up    time 900 s     heart_rate Z1
[repeat x3]
   [interval]  Trabajo      active     time 300 s     heart_rate Z4    cadenceRpm 90-95
   [interval]  Recuperación recovery   time 120 s     heart_rate Z1
[interval]  Enfriamiento    cool_down  time 600 s     heart_rate Z1

plannedDurationSeconds = 900 + 3 × (300 + 120) + 600 = 2760
```

### Running: progresivo por distancia con ritmo

```
Progresivo 8 km · running / road · tempo · primaryMetric: pace

[interval]  Calentamiento   warm_up    distance 2000 m   pace Z1
[interval]  Progresivo      active     distance 5000 m   pace Z3
[interval]  Enfriamiento    cool_down  distance 1000 m   pace Z1

plannedDurationSeconds = 0 (sin tiempo fijo; el usuario puede capturar una estimación)
plannedDistanceMeters  = 8000
```

### Pliometría: series y repeticiones

```
Pliometría inferior · plyometrics · power · primaryMetric: rpe

[exercise]  Box jump        4 sets × 8 reps    rest 90 s    rpe 8
[exercise]  Broad jump      3 sets × 6 reps    rest 60 s    rpe 7
[exercise]  Skater jumps    3 sets × 12 reps   rest 60 s

plannedDurationSeconds = 4×(8×3+90) + 3×(6×3+60) + 3×(12×3+60) = 456 + 234 + 288 = 978
```

### Movilidad: tiempo abierto

```
Movilidad de cadera · mobility · mobility · primaryMetric: rpe

[interval]  Flujo de cadera   active   open          rpe 3
[interval]  Respiración       cool_down time 300 s

plannedDurationSeconds = 300 (el paso abierto no suma); el usuario puede editarlo a 1200
```

## Migración desde el esquema v1

La migración `v2-structured-workouts` transforma los datos existentes:

| v1                                  | v2                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discipline: road \| mtb \| indoor` | `sport: cycling`, `modality` con el mismo valor                                                                                                                                                                                                                                                                         |
| `discipline: mobility`              | `sport: mobility`                                                                                                                                                                                                                                                                                                       |
| `discipline: strength`              | `sport: plyometrics`                                                                                                                                                                                                                                                                                                    |
| `workoutType: climbing`             | `category: endurance`                                                                                                                                                                                                                                                                                                   |
| `workoutType` (otros)               | `category` con el mismo valor                                                                                                                                                                                                                                                                                           |
| `intensityMetric: mixed`            | `primaryMetric: heart_rate`                                                                                                                                                                                                                                                                                             |
| `estimatedDurationMinutes`          | `plannedDurationSeconds = × 60`                                                                                                                                                                                                                                                                                         |
| `plannedDistanceKm`                 | `plannedDistanceMeters = × 1000`                                                                                                                                                                                                                                                                                        |
| `blocks[]`                          | `steps[]` de tipo `interval`: `blockType` → `phase` (`warm_up`, `active`, `recovery`, `cool_down`, `free` → `active`), `durationMinutes` → `time`, `distanceKm` → `distance`, `targetZoneId` + `targetZoneSnapshot` → `target.heart_rate` con snapshot nuevo, `cadenceMin/Max` → `cadenceRpm`, `instructions` → `notes` |
| `targetRpe` (sin zona)              | `target: { metric: 'rpe', value }`                                                                                                                                                                                                                                                                                      |
| `archived`                          | `isArchived`                                                                                                                                                                                                                                                                                                            |
| store `training_zones`              | un `TrainingZoneSetEntity` (`cycling`, `heart_rate`, `referenceValue` = FC máx del perfil)                                                                                                                                                                                                                              |
| store `sport_profiles`              | store `athlete_profiles`; `preferredDiscipline` → `preferredSport: cycling`                                                                                                                                                                                                                                             |

Los campos a nivel de entrenamiento `targetZoneId`, `targetRpe`, `cadenceMin/Max` de v1 se descartan: en v2 la intensidad se define por paso.
