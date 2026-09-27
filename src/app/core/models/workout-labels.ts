import { StepDurationType, StepKind } from '../domain/schemas/workout-step.schema';
import {
  IntensityMetric,
  Sport,
  StepPhase,
  WorkoutCategory,
  WorkoutStatus,
  type SportModality,
} from '../domain/workout.enums';

export const SPORT_LABELS: Record<Sport, string> = {
  [Sport.Cycling]: 'Ciclismo',
  [Sport.Running]: 'Running',
  [Sport.Mobility]: 'Movilidad',
  [Sport.Plyometrics]: 'Pliometría',
};

export const SPORT_MODALITY_LABELS: Record<SportModality, string> = {
  road: 'Ruta',
  mtb: 'MTB',
  gravel: 'Gravel',
  indoor: 'Indoor',
  trail: 'Trail',
  track: 'Pista',
  treadmill: 'Caminadora',
};

export const WORKOUT_CATEGORY_LABELS: Record<WorkoutCategory, string> = {
  [WorkoutCategory.Recovery]: 'Recuperación',
  [WorkoutCategory.Endurance]: 'Resistencia',
  [WorkoutCategory.Tempo]: 'Tempo',
  [WorkoutCategory.Threshold]: 'Umbral',
  [WorkoutCategory.Vo2Max]: 'VO2 máx',
  [WorkoutCategory.Technique]: 'Técnica',
  [WorkoutCategory.Strength]: 'Fuerza',
  [WorkoutCategory.Power]: 'Potencia',
  [WorkoutCategory.Mobility]: 'Movilidad',
  [WorkoutCategory.Free]: 'Libre',
};

export const WORKOUT_CATEGORY_COLOR_CLASSES: Record<WorkoutCategory, string> = {
  [WorkoutCategory.Recovery]: 'border-l-green-500',
  [WorkoutCategory.Endurance]: 'border-l-indigo-500',
  [WorkoutCategory.Tempo]: 'border-l-yellow-500',
  [WorkoutCategory.Threshold]: 'border-l-red-500',
  [WorkoutCategory.Vo2Max]: 'border-l-purple-500',
  [WorkoutCategory.Technique]: 'border-l-cyan-500',
  [WorkoutCategory.Strength]: 'border-l-orange-500',
  [WorkoutCategory.Power]: 'border-l-pink-500',
  [WorkoutCategory.Mobility]: 'border-l-teal-500',
  [WorkoutCategory.Free]: 'border-l-gray-400',
};

export const INTENSITY_METRIC_LABELS: Record<IntensityMetric, string> = {
  [IntensityMetric.HeartRate]: 'Frecuencia cardiaca',
  [IntensityMetric.Power]: 'Potencia',
  [IntensityMetric.Pace]: 'Ritmo',
  [IntensityMetric.Rpe]: 'RPE',
};

export const STEP_PHASE_LABELS: Record<StepPhase, string> = {
  [StepPhase.WarmUp]: 'Calentamiento',
  [StepPhase.Active]: 'Trabajo',
  [StepPhase.Recovery]: 'Recuperación',
  [StepPhase.Rest]: 'Descanso',
  [StepPhase.CoolDown]: 'Enfriamiento',
};

export const STEP_KIND_LABELS: Record<StepKind, string> = {
  [StepKind.Interval]: 'Intervalo',
  [StepKind.Exercise]: 'Ejercicio',
  [StepKind.Repeat]: 'Repetición',
};

export const STEP_DURATION_TYPE_LABELS: Record<StepDurationType, string> = {
  [StepDurationType.Time]: 'Tiempo',
  [StepDurationType.Distance]: 'Distancia',
  [StepDurationType.Open]: 'Abierto',
};

export const WORKOUT_STATUS_LABELS: Record<WorkoutStatus, string> = {
  [WorkoutStatus.Planned]: 'Planeado',
  [WorkoutStatus.Completed]: 'Completado',
  [WorkoutStatus.Skipped]: 'Omitido',
};
