export type AlertType = 'toast-success' | 'toast-danger' | 'toast-warning';

export interface AlertConfig {
  container: string;
  iconClass: string;
  iconLabel: string;
  svgPath: string;
}
