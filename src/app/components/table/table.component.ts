import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { Column } from '../../core/types/columns';
import { TableRow } from '../../core/types/table-row';

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table.component.html',
  styleUrl: './table.component.css',
})
export class TableComponent<T extends object, K extends keyof T> {
  columns = input.required<Column<T>[]>();
  data = input.required<TableRow<T, K>[]>();
  idKey = input.required<K>();

  selectedRow = output<T>();
  selected: T | null = null;

  selectRow(row: T) {
    this.selected = row;
    this.selectedRow.emit(row);
  }

  trackById = (_: number, item: TableRow<T, K>) => item.row[this.idKey()];
}
