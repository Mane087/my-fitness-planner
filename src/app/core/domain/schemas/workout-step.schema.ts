import { z } from 'zod';

import { IntensityMetric, STEP_PHASES } from '../workout.enums';
import { idSchema, metersSchema, secondsSchema } from './common.schema';
import { trainingZoneSnapshotSchema, zoneMetricSchema } from './training-zone-set.schema';

export const StepDurationType = {
  Time: 'time',
  Distance: 'distance',
  Open: 'open',
} as const;

export type StepDurationType = (typeof StepDurationType)[keyof typeof StepDurationType];

export const StepKind = {
  Interval: 'interval',
  Exercise: 'exercise',
  Repeat: 'repeat',
} as const;

export type StepKind = (typeof StepKind)[keyof typeof StepKind];

export const stepDurationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(StepDurationType.Time), seconds: secondsSchema }),
  z.object({ type: z.literal(StepDurationType.Distance), meters: metersSchema }),
  z.object({ type: z.literal(StepDurationType.Open) }),
]);

export type StepDuration = z.infer<typeof stepDurationSchema>;

export const rpeTargetSchema = z.object({
  metric: z.literal(IntensityMetric.Rpe),
  value: z
    .number()
    .int('El RPE debe ser un número entero.')
    .min(1, 'El RPE debe estar entre 1 y 10.')
    .max(10, 'El RPE debe estar entre 1 y 10.'),
});

export type RpeTarget = z.infer<typeof rpeTargetSchema>;

export const zoneTargetSchema = z
  .object({
    metric: zoneMetricSchema,
    zoneId: idSchema,
    zoneSnapshot: trainingZoneSnapshotSchema,
  })
  .refine((target) => target.zoneSnapshot.metric === target.metric, {
    message: 'La zona seleccionada no corresponde a la métrica del paso.',
    path: ['zoneSnapshot', 'metric'],
  });

export type ZoneTarget = z.infer<typeof zoneTargetSchema>;

export const intensityTargetSchema = z.discriminatedUnion('metric', [
  zoneTargetSchema,
  rpeTargetSchema,
]);

export type IntensityTarget = z.infer<typeof intensityTargetSchema>;

export const cadenceRangeSchema = z
  .object({
    min: z.number().int().nonnegative('La cadencia debe ser positiva.'),
    max: z.number().int().nonnegative('La cadencia debe ser positiva.'),
  })
  .refine((range) => range.min <= range.max, {
    message: 'La cadencia mínima no puede ser mayor que la máxima.',
    path: ['max'],
  });

export type CadenceRange = z.infer<typeof cadenceRangeSchema>;

const stepNameSchema = z.string().trim().min(1, 'El nombre del paso es requerido.').max(80);
const stepNotesSchema = z.string().trim().max(500).optional();

export const intervalStepSchema = z.object({
  id: idSchema,
  kind: z.literal(StepKind.Interval),
  name: stepNameSchema,
  phase: z.enum(STEP_PHASES),
  duration: stepDurationSchema,
  target: intensityTargetSchema.optional(),
  cadenceRpm: cadenceRangeSchema.optional(),
  notes: stepNotesSchema,
});

export type IntervalStep = z.infer<typeof intervalStepSchema>;

export const exerciseStepSchema = z.object({
  id: idSchema,
  kind: z.literal(StepKind.Exercise),
  name: stepNameSchema,
  sets: z.number().int().min(1, 'Las series deben ser al menos 1.'),
  reps: z.number().int().min(1, 'Las repeticiones deben ser al menos 1.'),
  loadKg: z.number().positive('La carga debe ser mayor que cero.').optional(),
  restSeconds: z.number().int().nonnegative('El descanso no puede ser negativo.').optional(),
  target: rpeTargetSchema.optional(),
  notes: stepNotesSchema,
});

export type ExerciseStep = z.infer<typeof exerciseStepSchema>;

export const leafStepSchema = z.discriminatedUnion('kind', [
  intervalStepSchema,
  exerciseStepSchema,
]);

export type LeafStep = z.infer<typeof leafStepSchema>;

export const repeatStepSchema = z.object({
  id: idSchema,
  kind: z.literal(StepKind.Repeat),
  repetitions: z.number().int().min(2, 'Una repetición debe ejecutarse al menos 2 veces.'),
  steps: z.array(leafStepSchema).min(1, 'Una repetición debe contener al menos un paso.'),
});

export type RepeatStep = z.infer<typeof repeatStepSchema>;

export const workoutStepSchema = z.discriminatedUnion('kind', [
  intervalStepSchema,
  exerciseStepSchema,
  repeatStepSchema,
]);

export type WorkoutStep = z.infer<typeof workoutStepSchema>;

/** Ids of every step, including repeat groups and the steps inside them. */
export function collectStepIds(steps: readonly WorkoutStep[]): string[] {
  return steps.flatMap((step) =>
    step.kind === StepKind.Repeat ? [step.id, ...step.steps.map((child) => child.id)] : [step.id],
  );
}
