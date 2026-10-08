import type { IconName } from '../../components/ui/ui-icon/icon-registry';
import { Sport } from '../../core/domain/workout.enums';

export const SPORT_ICONS: Record<Sport, IconName> = {
  [Sport.Cycling]: 'bike',
  [Sport.Running]: 'activity',
  [Sport.Mobility]: 'person-standing',
  [Sport.Plyometrics]: 'trending-up',
};
