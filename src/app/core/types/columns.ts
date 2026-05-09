export interface Column<T> {
  key: keyof T;
  title: string;
}
