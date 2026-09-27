import type {
  RepeatStep,
  WorkoutStep,
} from '../../src/app/core/domain/schemas/workout-step.schema';
import {
  addStep,
  addStepToRepeat,
  clearIncompatibleTargets,
  moveStep,
  removeStep,
  replaceStep,
} from '../../src/app/components/workout-step-editor/workout-step-operations';
import {
  exercise,
  heartRateSnapshot,
  heartRateZoneSet,
  interval,
  repeat,
} from '../domain/fixtures';

const ids = (steps: readonly WorkoutStep[]) => steps.map((step) => step.id);
const childIds = (steps: readonly WorkoutStep[], repeatId: string) =>
  (steps.find((step) => step.id === repeatId) as RepeatStep).steps.map((step) => step.id);

describe('workout step operations', () => {
  const base: WorkoutStep[] = [interval('a'), repeat('r'), exercise('z')];

  describe('addStep', () => {
    it('appends an interval, an exercise or a repeat group with one interval', () => {
      const withInterval = addStep([], 'interval');
      const withExercise = addStep(withInterval, 'exercise');
      const withRepeat = addStep(withExercise, 'repeat');

      expect(withRepeat.map((step) => step.kind)).toEqual(['interval', 'exercise', 'repeat']);
      expect((withRepeat[2] as RepeatStep).repetitions).toBe(2);
      expect((withRepeat[2] as RepeatStep).steps.map((step) => step.kind)).toEqual(['interval']);
    });

    it('does not mutate the original list', () => {
      const original = [interval('a')];

      addStep(original, 'interval');

      expect(ids(original)).toEqual(['a']);
    });
  });

  describe('addStepToRepeat', () => {
    it('adds leaf steps inside the matching repeat group only', () => {
      const result = addStepToRepeat(base, 'r', 'exercise');

      const group = result[1] as RepeatStep;
      expect(group.steps.map((step) => step.kind)).toEqual(['interval', 'interval', 'exercise']);
      expect(result[0]).toBe(base[0]);
    });
  });

  describe('removeStep', () => {
    it('removes a top-level step', () => {
      expect(ids(removeStep(base, 'z'))).toEqual(['a', 'r']);
    });

    it('removes a step inside a repeat group and keeps the group', () => {
      const result = removeStep(base, 'r-work');

      expect(ids(result)).toEqual(['a', 'r', 'z']);
      expect(childIds(result, 'r')).toEqual(['r-rest']);
    });

    it('removes a whole repeat group', () => {
      expect(ids(removeStep(base, 'r'))).toEqual(['a', 'z']);
    });
  });

  describe('moveStep', () => {
    it('moves top-level steps up and down', () => {
      expect(ids(moveStep(base, 'z', -1))).toEqual(['a', 'z', 'r']);
      expect(ids(moveStep(base, 'a', 1))).toEqual(['r', 'a', 'z']);
    });

    it('ignores moves beyond the list limits', () => {
      expect(ids(moveStep(base, 'a', -1))).toEqual(['a', 'r', 'z']);
      expect(ids(moveStep(base, 'z', 1))).toEqual(['a', 'r', 'z']);
    });

    it('moves steps inside their repeat group without leaving it', () => {
      const result = moveStep(base, 'r-rest', -1);

      expect(childIds(result, 'r')).toEqual(['r-rest', 'r-work']);
      expect(ids(moveStep(result, 'r-rest', -1))).toEqual(['a', 'r', 'z']);
      expect(childIds(moveStep(result, 'r-rest', -1), 'r')).toEqual(['r-rest', 'r-work']);
    });
  });

  describe('replaceStep', () => {
    it('replaces a top-level step and a step inside a repeat group', () => {
      const renamed = replaceStep(base, interval('a', { name: 'Calentamiento' }));
      const renamedChild = replaceStep(renamed, interval('r-work', { name: 'Serie' }));

      expect(renamedChild[0]).toMatchObject({ name: 'Calentamiento' });
      expect((renamedChild[1] as RepeatStep).steps[0]).toMatchObject({ name: 'Serie' });
    });

    it('updates the repetitions of a repeat group', () => {
      const result = replaceStep(base, { ...(base[1] as RepeatStep), repetitions: 6 });

      expect((result[1] as RepeatStep).repetitions).toBe(6);
    });
  });

  describe('clearIncompatibleTargets', () => {
    const zoneSet = heartRateZoneSet();
    const zoneTarget = {
      metric: 'heart_rate' as const,
      zoneId: 'z2',
      zoneSnapshot: heartRateSnapshot({ zoneSetId: zoneSet.id, zoneId: 'z2' }),
    };

    it('keeps zone targets of the current zone set', () => {
      const steps = [interval('a', { target: zoneTarget })];

      expect(clearIncompatibleTargets(steps, 'heart_rate', zoneSet)[0]).toHaveProperty('target');
    });

    it('drops zone targets when the metric changes to RPE or another zone set', () => {
      const steps: WorkoutStep[] = [
        interval('a', { target: zoneTarget }),
        repeat('r', { steps: [interval('r-1', { target: zoneTarget })] }),
      ];

      const toRpe = clearIncompatibleTargets(steps, 'rpe', null);
      const toOtherSet = clearIncompatibleTargets(steps, 'heart_rate', { ...zoneSet, id: 'other' });

      expect(toRpe[0]).not.toHaveProperty('target');
      expect((toRpe[1] as RepeatStep).steps[0]).not.toHaveProperty('target');
      expect(toOtherSet[0]).not.toHaveProperty('target');
    });

    it('drops interval RPE targets when the metric is a zone metric but keeps exercise RPE', () => {
      const steps: WorkoutStep[] = [
        interval('a', { target: { metric: 'rpe', value: 5 } }),
        exercise('e', { target: { metric: 'rpe', value: 8 } }),
      ];

      const result = clearIncompatibleTargets(steps, 'heart_rate', zoneSet);

      expect(result[0]).not.toHaveProperty('target');
      expect(result[1]).toMatchObject({ target: { metric: 'rpe', value: 8 } });
    });
  });
});
