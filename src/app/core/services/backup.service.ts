import { inject, Injectable } from '@angular/core';

import {
  BACKUP_SCHEMA_VERSION,
  SUPPORTED_BACKUP_SCHEMA_VERSIONS,
  backupHeaderSchema,
  backupSchema,
  type Backup,
} from '../domain/schemas/backup.schema';
import { nowIso } from '../domain/entity-utils';
import { IndexedDbStore } from '../storage/indexed-db.config';
import { IndexedDbService } from '../storage/indexed-db.service';

export interface BackupFile {
  fileName: string;
  mimeType: string;
  content: string;
}

export interface BackupImportSummary {
  scheduledWorkouts: number;
  workoutTemplates: number;
  trainingZoneSets: number;
  athleteProfiles: number;
}

/** Error with a Spanish message that the UI can show as is. */
export class BackupImportError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BackupImportError';
  }
}

const BACKUP_STORES = [
  IndexedDbStore.ScheduledWorkouts,
  IndexedDbStore.WorkoutTemplates,
  IndexedDbStore.TrainingZoneSets,
  IndexedDbStore.AthleteProfiles,
  IndexedDbStore.AppSettings,
] as const;

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly indexedDb = inject(IndexedDbService);

  async createBackupFile(exportDate = new Date()): Promise<BackupFile> {
    const stores = await this.indexedDb.readStores(BACKUP_STORES);
    const backup: Backup = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: nowIso(),
      stores,
    };

    return {
      fileName: `my-fitness-planner-backup-${formatLocalDate(exportDate)}.json`,
      mimeType: 'application/json',
      content: JSON.stringify(backup, null, 2),
    };
  }

  /** Validates the whole file first; only a fully valid backup replaces the current data. */
  async importBackup(content: string): Promise<BackupImportSummary> {
    const backup = parseBackup(content);

    try {
      await this.indexedDb.replaceStores(backup.stores);
    } catch (error) {
      throw new BackupImportError(
        'No se pudo importar el respaldo. Tus datos actuales no se modificaron.',
        { cause: error },
      );
    }

    return {
      scheduledWorkouts: backup.stores.scheduled_workouts.length,
      workoutTemplates: backup.stores.workout_templates.length,
      trainingZoneSets: backup.stores.training_zone_sets.length,
      athleteProfiles: backup.stores.athlete_profiles.length,
    };
  }
}

function parseBackup(content: string): Backup {
  let data: unknown;

  try {
    data = JSON.parse(content);
  } catch (error) {
    throw new BackupImportError('El archivo no es un JSON válido.', { cause: error });
  }

  const header = backupHeaderSchema.safeParse(data);

  if (!header.success) {
    throw new BackupImportError('El archivo no es un respaldo de MyFitnessPlanner.');
  }

  if (!isSupportedVersion(header.data.schemaVersion)) {
    throw new BackupImportError(
      `El respaldo es de la versión ${header.data.schemaVersion} y esta aplicación solo acepta las versiones ${SUPPORTED_BACKUP_SCHEMA_VERSIONS.join(' y ')}.`,
    );
  }

  const result = backupSchema.safeParse(data);

  if (!result.success) {
    const issue = result.error.issues[0];
    const location = issue ? describeLocation(issue.path) : '';
    throw new BackupImportError(
      `El respaldo tiene datos inválidos${location}: ${issue?.message ?? 'formato desconocido'}`,
    );
  }

  return result.data;
}

function isSupportedVersion(version: number): boolean {
  return (SUPPORTED_BACKUP_SCHEMA_VERSIONS as readonly number[]).includes(version);
}

const STORE_LABELS: Record<string, string> = {
  scheduled_workouts: 'entrenamiento',
  workout_templates: 'plantilla',
  training_zone_sets: 'conjunto de zonas',
  athlete_profiles: 'perfil',
  app_settings: 'configuración',
};

function describeLocation(path: readonly PropertyKey[]): string {
  const [root, storeName, index] = path;

  if (root !== 'stores' || typeof storeName !== 'string' || typeof index !== 'number') {
    return '';
  }

  return ` (${STORE_LABELS[storeName] ?? storeName} ${index + 1})`;
}

function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
