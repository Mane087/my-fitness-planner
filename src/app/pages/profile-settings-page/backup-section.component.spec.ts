import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  BackupImportError,
  BackupService,
  type BackupImportSummary,
} from '../../core/services/backup.service';
import { BackupSectionComponent } from './backup-section.component';

const SUMMARY: BackupImportSummary = {
  scheduledWorkouts: 3,
  workoutTemplates: 1,
  trainingZoneSets: 2,
  athleteProfiles: 1,
};

// jsdom used by Jest does not implement Blob.text(); browsers do. Polyfill it with FileReader.
if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function text(this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

describe('BackupSectionComponent', () => {
  let fixture: ComponentFixture<BackupSectionComponent>;
  let backups: jest.Mocked<Pick<BackupService, 'createBackupFile' | 'importBackup'>>;
  let element: HTMLElement;

  beforeEach(() => {
    backups = { createBackupFile: jest.fn(), importBackup: jest.fn() };
    Object.assign(URL, {
      createObjectURL: jest.fn(() => 'blob:backup'),
      revokeObjectURL: jest.fn(),
    });

    TestBed.configureTestingModule({
      imports: [BackupSectionComponent],
      providers: [{ provide: BackupService, useValue: backups }],
    });

    fixture = TestBed.createComponent(BackupSectionComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  function button(label: string): HTMLButtonElement {
    const match = Array.from(element.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!match) throw new Error(`Button "${label}" not found`);
    return match;
  }

  async function selectFile(content: string, fileName = 'respaldo.json'): Promise<void> {
    const input = element.querySelector<HTMLInputElement>('[data-testid="backup-file-input"]');
    const file = new File([content], fileName, { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    await fixture.componentInstance.selectFile({ target: input } as unknown as Event);
    fixture.detectChanges();
  }

  function dialog(): HTMLElement | null {
    return element.querySelector('[role="dialog"]');
  }

  it('downloads the backup file with its name', async () => {
    backups.createBackupFile.mockResolvedValue({
      fileName: 'my-fitness-planner-backup-2026-09-27.json',
      mimeType: 'application/json',
      content: '{}',
    });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      /* avoid jsdom navigation */
    });

    button('Exportar respaldo').click();
    await fixture.whenStable();
    fixture.detectChanges();

    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('my-fitness-planner-backup-2026-09-27.json');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:backup');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Respaldo descargado: my-fitness-planner-backup-2026-09-27.json',
    );
  });

  it('asks for confirmation before importing', async () => {
    await selectFile('{"schemaVersion":2}');

    expect(dialog()?.textContent).toContain('¿Reemplazar todos tus datos?');
    expect(dialog()?.textContent).toContain('respaldo.json');
    expect(backups.importBackup).not.toHaveBeenCalled();
  });

  it('imports the file after confirmation and notifies the page', async () => {
    backups.importBackup.mockResolvedValue(SUMMARY);
    const imported = jest.fn();
    fixture.componentInstance.imported.subscribe(imported);
    await selectFile('{"schemaVersion":2}');

    button('Importar y reemplazar').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(backups.importBackup).toHaveBeenCalledWith('{"schemaVersion":2}');
    expect(imported).toHaveBeenCalledWith(SUMMARY);
    expect(dialog()).toBeNull();
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      '3 entrenamientos, 1 plantillas y 2 conjuntos de zonas',
    );
  });

  it('does not import when the user cancels', async () => {
    await selectFile('{}');

    button('Cancelar').click();
    fixture.detectChanges();

    expect(dialog()).toBeNull();
    expect(backups.importBackup).not.toHaveBeenCalled();
  });

  it('cancels the pending import with Escape, but not while it is importing', async () => {
    const pressEscape = () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
    };
    await selectFile('{}');
    pressEscape();
    expect(dialog()).toBeNull();

    backups.importBackup.mockImplementation(() => new Promise(() => undefined));
    await selectFile('{"schemaVersion":2}');
    button('Importar y reemplazar').click();
    pressEscape();

    expect(dialog()).not.toBeNull();
    expect(backups.importBackup).toHaveBeenCalledTimes(1);
  });

  it('shows the validation message of an invalid backup', async () => {
    backups.importBackup.mockImplementation(async () => {
      throw new BackupImportError('El archivo no es un JSON válido.');
    });
    const imported = jest.fn();
    fixture.componentInstance.imported.subscribe(imported);
    await selectFile('no es json');

    button('Importar y reemplazar').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'El archivo no es un JSON válido.',
    );
    expect(imported).not.toHaveBeenCalled();
  });
});
