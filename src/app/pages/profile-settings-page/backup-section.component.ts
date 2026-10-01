import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';

import { ButtonComponent } from '../../components/button/button.component';
import { ModalComponent } from '../../layouts/modal/modal.component';
import {
  BackupImportError,
  BackupService,
  type BackupImportSummary,
} from '../../core/services/backup.service';

interface PendingImport {
  fileName: string;
  content: string;
}

interface StatusMessage {
  isError: boolean;
  text: string;
}

@Component({
  selector: 'app-backup-section',
  imports: [ButtonComponent, ModalComponent],
  templateUrl: './backup-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackupSectionComponent {
  private readonly backupService = inject(BackupService);
  private readonly document = inject(DOCUMENT);

  /** Emitted after a successful import so the page reloads the restored data. */
  readonly imported = output<BackupImportSummary>();

  readonly isExporting = signal(false);
  readonly isImporting = signal(false);
  readonly pendingImport = signal<PendingImport | null>(null);
  readonly status = signal<StatusMessage | null>(null);

  async exportBackup(): Promise<void> {
    this.isExporting.set(true);
    this.status.set(null);

    try {
      const file = await this.backupService.createBackupFile();
      this.download(file.fileName, file.mimeType, file.content);
      this.status.set({ isError: false, text: `Respaldo descargado: ${file.fileName}` });
    } catch {
      this.status.set({
        isError: true,
        text: 'No se pudo generar el respaldo. Intenta nuevamente.',
      });
    } finally {
      this.isExporting.set(false);
    }
  }

  async selectFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so selecting the same file again still triggers a change event.
    input.value = '';

    if (!file) return;

    this.status.set(null);

    try {
      this.pendingImport.set({ fileName: file.name, content: await file.text() });
    } catch {
      this.status.set({ isError: true, text: 'No se pudo leer el archivo seleccionado.' });
    }
  }

  cancelImport(): void {
    // The import replaces the whole database; once it started it cannot be cancelled.
    if (this.isImporting()) return;
    this.pendingImport.set(null);
  }

  async confirmImport(): Promise<void> {
    const pending = this.pendingImport();

    if (!pending) return;

    this.isImporting.set(true);

    try {
      const summary = await this.backupService.importBackup(pending.content);
      this.status.set({
        isError: false,
        text: `Respaldo importado: ${summary.scheduledWorkouts} entrenamientos, ${summary.workoutTemplates} plantillas y ${summary.trainingZoneSets} conjuntos de zonas.`,
      });
      this.imported.emit(summary);
    } catch (error) {
      this.status.set({
        isError: true,
        text:
          error instanceof BackupImportError
            ? error.message
            : 'No se pudo importar el respaldo. Tus datos actuales no se modificaron.',
      });
    } finally {
      this.isImporting.set(false);
      this.pendingImport.set(null);
    }
  }

  private download(fileName: string, mimeType: string, content: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
