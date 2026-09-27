export interface TableRow<T, K extends keyof T> {
  row: T;
  idKey: K;
}
