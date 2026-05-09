# FEAT-080526: Add IndexedDB local persistence for workout data #1

## Context

The MVP is a personal cycling workout planner. The user needs to create, edit, move, copy, delete, and review planned workouts in a calendar without depending on a paid external platform.

Since the MVP does not require multi-device sync, social features, cloud backups, or integrations with Garmin, Strava, Wahoo, Zwift, or TrainingPeaks, a backend would be unnecessary at this stage.

IndexedDB will be used as the source of truth for local data persistence.

## Objective

Implement a local persistence layer using IndexedDB that supports the MVP domain:

- sport profile
- training zones
- workout templates
- scheduled workouts
- workout blocks
- application settings

The IndexedDB implementation must be abstracted behind Angular services/repositories so UI components never access IndexedDB directly.

## Cases to Consider

- Database initialization on first app load
- Idempotent seed data for default zones and settings
- CRUD operations for all entities
- Weekly/date range queries for scheduled workouts
- Move and copy operations for scheduled workouts
- Template scheduling to create independent workout copies
- Error handling for unavailable database and failed transactions

## Acceptance Criteria

1. Database `cycling_training_planner_db` is created on first app load
2. All required object stores exist with proper indexes
3. Default settings, sport profile, and training zones are seeded if missing
4. Scheduled workouts can be created, updated, moved, copied, and deleted
5. Workout templates can be created, archived, and restored
6. Weekly date range queries return correct workouts
7. Scheduling a template creates an independent workout with sourceTemplateId
8. Components never access IndexedDB directly

## Expected Results

- IndexedDB service handles all database operations
- Repository services abstract IndexedDB access
- Domain services coordinate calendar-specific operations
- All persisted entities have stable IDs and timestamp fields

## Additional Information

Affected files/modules:

- `src/app/core/storage/indexed-db.service.ts`
- `src/app/core/storage/indexed-db.config.ts`
- `src/app/core/storage/indexed-db.types.ts`
- `src/app/core/storage/indexed-db.migrations.ts`
- `src/app/core/repositories/sport-profile.repository.ts`
- `src/app/core/repositories/training-zone.repository.ts`
- `src/app/core/repositories/workout-template.repository.ts`
- `src/app/core/repositories/scheduled-workout.repository.ts`
- `src/app/core/repositories/app-settings.repository.ts`
- `src/app/core/domain/workout.enums.ts`
- `src/app/core/domain/sport-profile.model.ts`
- `src/app/core/domain/training-zone.model.ts`
- `src/app/core/domain/workout-block.model.ts`
- `src/app/core/domain/workout-template.model.ts`
- `src/app/core/domain/scheduled-workout.model.ts`
- `src/app/core/domain/app-settings.model.ts`
- `src/app/core/services/training-calendar.service.ts`
- `src/app/core/services/weekly-summary.service.ts`
- `src/app/core/services/workout-template-scheduler.service.ts`
