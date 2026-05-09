# OpenSpec Change: Add IndexedDB Local Persistence

# 1. Context

The MVP is a personal cycling workout planner. The user needs to create, edit, move, copy, delete, and review planned workouts in a calendar without depending on a paid external platform.

Since the MVP does not require multi-device sync, social features, cloud backups, or integrations with Garmin, Strava, Wahoo, Zwift, or TrainingPeaks, a backend would be unnecessary at this stage.

IndexedDB will be used as the source of truth for local data persistence.

---

# 2. Problem

The application needs persistent local storage for structured training data.

Using in-memory state would lose all workouts after page refresh. Using only `localStorage` would be too limited for structured entities, filtering, indexing, schema versioning, and future migrations.

IndexedDB is better suited for this MVP because it supports:

- structured object stores,
- indexed queries,
- larger storage capacity,
- asynchronous access,
- schema versioning,
- future migration paths.

---

# 3. Goal

Implement a local persistence layer using IndexedDB that supports the MVP domain:

- sport profile,
- training zones,
- workout templates,
- scheduled workouts,
- workout blocks,
- application settings.

The IndexedDB implementation must be abstracted behind Angular services/repositories so UI components never access IndexedDB directly.

---

# 4. Non-goals

This change must not include:

- backend API,
- authentication,
- cloud sync,
- import/export from Garmin, Strava, Wahoo, Zwift, TrainingPeaks, `.fit`, `.tcx`, `.gpx`, or `.zwo`,
- advanced training load metrics such as TSS, CTL, ATL, TSB,
- multi-user support,
- role-based access,
- payment/subscription logic,
- real-time collaboration,
- server-side backups.

---

# 5. Scope

## In scope

- Create the IndexedDB database.
- Define object stores and indexes.
- Create an IndexedDB access layer.
- Create repository services for each main entity.
- Add seed data for default training zones and default settings.
- Add basic migration/versioning support.
- Support CRUD operations for workouts, templates, zones, profile, and settings.
- Support weekly queries for scheduled workouts.

## Out of scope

- UI implementation of the full calendar.
- Advanced analytics.
- External platform synchronization.
- Login/authentication.
- Backend persistence.

---

# 6. Business Rules

## 6.1 General persistence rules

### Rule: IndexedDB is the local source of truth

All persisted MVP data must be stored in IndexedDB.

The Angular state may cache data temporarily, but IndexedDB remains the persistent source of truth.

### Rule: Components must not access IndexedDB directly

Angular components must use domain services or repository services.

Invalid:

```ts
const request = indexedDB.open('cycling-planner-db');
```

Valid:

```ts
this.scheduledWorkoutRepository.findByDateRange(startDate, endDate);
```

### Rule: Every persisted entity must have an ID

Each persisted entity must use a stable unique ID.

Recommended format:

```ts
crypto.randomUUID();
```

### Rule: Every persisted entity must track timestamps

Each entity should include:

```ts
createdAt: string;
updatedAt: string;
```

Dates must be stored as ISO strings.

Example:

```ts
2026-05-08T21:30:00.000Z
```

### Rule: Deletions must be explicit

For user-owned data such as workouts and templates, deletion should be intentional.

For templates, prefer archiving over physical deletion.

For scheduled workouts, physical deletion is acceptable in the MVP, but the UI must ask for confirmation.

---

# 7. Database Design

## 7.1 Database name

```txt
cycling_training_planner_db
```

## 7.2 Initial database version

```txt
1
```

---

# 8. Object Stores

## 8.1 `sport_profiles`

Stores the user's sport configuration.

### Purpose

Keep athlete-specific configuration separate from hardcoded values.

### Key path

```ts
id;
```

### Expected records

For MVP, only one active profile is expected.

### Fields

```ts
interface SportProfileEntity {
  id: string;
  name: string;
  maxHeartRate: number;
  weightKg?: number;
  preferredDiscipline: 'road' | 'mtb' | 'indoor' | 'mixed';
  preferredIntensityMetric: 'heart_rate' | 'rpe' | 'mixed';
  weekStartsOn: 'monday' | 'sunday';
  createdAt: string;
  updatedAt: string;
}
```

### Indexes

| Index     | Field  | Unique | Purpose         |
| --------- | ------ | -----: | --------------- |
| `by_name` | `name` |     No | Optional lookup |

### Rules

- `name` is required.
- `maxHeartRate` must be greater than 0.
- `weekStartsOn` defaults to `monday`.
- `preferredIntensityMetric` defaults to `heart_rate`.
- The app should create a default profile if none exists.

---

## 8.2 `training_zones`

Stores configurable training zones.

### Purpose

Allow the app to calculate and display target intensity zones without hardcoding values.

### Key path

```ts
id;
```

### Fields

```ts
interface TrainingZoneEntity {
  id: string;
  name: string;
  description?: string;
  minHeartRate: number;
  maxHeartRate: number;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Indexes

| Index           | Field       | Unique | Purpose              |
| --------------- | ----------- | -----: | -------------------- |
| `by_sort_order` | `sortOrder` |     No | Ordered zone display |
| `by_name`       | `name`      |     No | Search/display       |

### Rules

- `name` is required.
- `minHeartRate` is required.
- `maxHeartRate` is required.
- `minHeartRate` must be lower than or equal to `maxHeartRate`.
- Zones should not overlap.
- Zones must be ordered by `sortOrder`.
- The app should seed default zones if none exist.
- Editing a zone must not silently rewrite historical workout meaning.
- Scheduled workouts should store a snapshot of the selected zone.

---

## 8.3 `workout_templates`

Stores reusable workout structures without calendar dates.

### Purpose

Allow the user to create reusable workout templates such as:

- Base Z2 - 60 min,
- Recovery Ride - 45 min,
- Long Ride - 2h,
- Controlled Climbs - 75 min.

### Key path

```ts
id;
```

### Fields

```ts
interface WorkoutTemplateEntity {
  id: string;
  title: string;
  workoutType: WorkoutType;
  discipline: WorkoutDiscipline;
  estimatedDurationMinutes: number;
  targetZoneId?: string;
  targetZoneSnapshot?: TrainingZoneSnapshot;
  targetRpe?: number;
  cadenceMin?: number;
  cadenceMax?: number;
  objective?: string;
  notes?: string;
  blocks: WorkoutBlockEntity[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Indexes

| Index             | Field         | Unique | Purpose               |
| ----------------- | ------------- | -----: | --------------------- |
| `by_archived`     | `archived`    |     No | Show active templates |
| `by_workout_type` | `workoutType` |     No | Filter by type        |
| `by_discipline`   | `discipline`  |     No | Filter by discipline  |
| `by_title`        | `title`       |     No | Search by title       |

### Rules

- A template must not have a scheduled date.
- `title` is required.
- `estimatedDurationMinutes` must be greater than 0.
- `workoutType` is required.
- `discipline` is required.
- A template can contain zero or more blocks.
- If blocks exist, each block must have duration greater than 0.
- Archiving a template hides it from the main selection list.
- Editing a template must not modify already scheduled workouts created from it.

---

## 8.4 `scheduled_workouts`

Stores workouts placed on the calendar.

### Purpose

Represent actual planned workouts assigned to a specific date.

### Key path

```ts
id;
```

### Fields

```ts
interface ScheduledWorkoutEntity {
  id: string;
  title: string;
  scheduledDate: string;
  workoutType: WorkoutType;
  discipline: WorkoutDiscipline;
  estimatedDurationMinutes: number;
  targetZoneId?: string;
  targetZoneSnapshot?: TrainingZoneSnapshot;
  targetRpe?: number;
  cadenceMin?: number;
  cadenceMax?: number;
  objective?: string;
  notes?: string;
  status: WorkoutStatus;
  blocks: WorkoutBlockEntity[];
  sourceTemplateId?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Indexes

| Index                | Field                          | Unique | Purpose                          |
| -------------------- | ------------------------------ | -----: | -------------------------------- |
| `by_scheduled_date`  | `scheduledDate`                |     No | Calendar queries                 |
| `by_status`          | `status`                       |     No | Filter planned/completed/skipped |
| `by_workout_type`    | `workoutType`                  |     No | Weekly summaries                 |
| `by_discipline`      | `discipline`                   |     No | Weekly summaries                 |
| `by_date_and_status` | `[scheduledDate, status]`      |     No | Calendar + status filter         |
| `by_date_and_type`   | `[scheduledDate, workoutType]` |     No | Calendar + type filter           |

### Rules

- `title` is required.
- `scheduledDate` is required.
- `scheduledDate` must be stored as a date-only ISO string: `YYYY-MM-DD`.
- `estimatedDurationMinutes` must be greater than 0.
- `workoutType` is required.
- `discipline` is required.
- `status` defaults to `planned`.
- A scheduled workout may exist without blocks.
- A scheduled workout may have multiple blocks.
- If blocks exist, all blocks must have positive duration.
- Moving a workout updates only `scheduledDate` and `updatedAt`.
- Copying a workout creates a new record with a new ID.
- Deleting a workout removes only that workout.
- A day can contain multiple workouts.

---

## 8.5 `app_settings`

Stores application-level preferences.

### Purpose

Persist local UI and system preferences.

### Key path

```ts
id;
```

### Fields

```ts
interface AppSettingsEntity {
  id: string;
  calendarDefaultView: 'week' | 'month';
  weekStartsOn: 'monday' | 'sunday';
  timeFormat: '12h' | '24h';
  createdAt: string;
  updatedAt: string;
}
```

### Indexes

No additional indexes required for MVP.

### Rules

- The app should create default settings if none exist.
- `calendarDefaultView` defaults to `week`.
- `weekStartsOn` defaults to `monday`.
- `timeFormat` defaults to `24h`.

---

# 9. Shared Types

## 9.1 `WorkoutType`

```ts
type WorkoutType =
  | 'recovery'
  | 'base'
  | 'endurance'
  | 'climbing'
  | 'tempo'
  | 'threshold'
  | 'vo2max'
  | 'technique'
  | 'free';
```

## 9.2 `WorkoutDiscipline`

```ts
type WorkoutDiscipline = 'road' | 'mtb' | 'indoor' | 'strength' | 'mobility';
```

## 9.3 `WorkoutStatus`

```ts
type WorkoutStatus = 'planned' | 'completed' | 'skipped';
```

## 9.4 `TrainingZoneSnapshot`

```ts
interface TrainingZoneSnapshot {
  id: string;
  name: string;
  minHeartRate: number;
  maxHeartRate: number;
}
```

## 9.5 `WorkoutBlockEntity`

```ts
interface WorkoutBlockEntity {
  id: string;
  name: string;
  durationMinutes: number;
  targetZoneId?: string;
  targetZoneSnapshot?: TrainingZoneSnapshot;
  targetRpe?: number;
  cadenceMin?: number;
  cadenceMax?: number;
  instructions?: string;
  sortOrder: number;
}
```

---

# 10. Angular Architecture

## 10.1 Recommended folder structure

```txt
src/app/core/storage/
  indexed-db.service.ts
  indexed-db.config.ts
  indexed-db.types.ts
  indexed-db.migrations.ts

src/app/core/repositories/
  sport-profile.repository.ts
  training-zone.repository.ts
  workout-template.repository.ts
  scheduled-workout.repository.ts
  app-settings.repository.ts

src/app/core/domain/
  sport-profile.model.ts
  training-zone.model.ts
  workout-template.model.ts
  scheduled-workout.model.ts
  workout-block.model.ts
  workout.enums.ts

src/app/core/services/
  training-calendar.service.ts
  weekly-summary.service.ts
  workout-template-scheduler.service.ts
```

---

# 11. Technical Rules

## 11.1 IndexedDB access

### Rule: Use one low-level IndexedDB service

Only `IndexedDbService` should directly open database connections and manage transactions.

Repositories must use this service.

Components must use repositories or domain services.

### Rule: Database initialization must be idempotent

The app must safely initialize IndexedDB multiple times without duplicating seed data.

### Rule: Database upgrade must be centralized

Object store creation and schema upgrades must be defined in a single place.

Recommended file:

```txt
indexed-db.migrations.ts
```

### Rule: Use transactions per operation

Each create, update, delete, or read operation must open the correct transaction mode:

| Operation | Transaction mode |
| --------- | ---------------- |
| Read      | `readonly`       |
| Create    | `readwrite`      |
| Update    | `readwrite`      |
| Delete    | `readwrite`      |

### Rule: Avoid direct mutation of stored records

When updating entities, create a new object with updated fields instead of mutating references directly.

---

# 12. Repository Requirements

## 12.1 `SportProfileRepository`

Required methods:

```ts
getActiveProfile(): Promise<SportProfileEntity | null>;
createDefaultProfile(): Promise<SportProfileEntity>;
save(profile: SportProfileEntity): Promise<SportProfileEntity>;
update(profile: SportProfileEntity): Promise<SportProfileEntity>;
```

---

## 12.2 `TrainingZoneRepository`

Required methods:

```ts
findAll(): Promise<TrainingZoneEntity[]>;
findById(id: string): Promise<TrainingZoneEntity | null>;
create(zone: TrainingZoneEntity): Promise<TrainingZoneEntity>;
update(zone: TrainingZoneEntity): Promise<TrainingZoneEntity>;
delete(id: string): Promise<void>;
seedDefaultZonesIfEmpty(maxHeartRate: number): Promise<void>;
```

---

## 12.3 `WorkoutTemplateRepository`

Required methods:

```ts
findAllActive(): Promise<WorkoutTemplateEntity[]>;
findAllArchived(): Promise<WorkoutTemplateEntity[]>;
findById(id: string): Promise<WorkoutTemplateEntity | null>;
create(template: WorkoutTemplateEntity): Promise<WorkoutTemplateEntity>;
update(template: WorkoutTemplateEntity): Promise<WorkoutTemplateEntity>;
archive(id: string): Promise<void>;
restore(id: string): Promise<void>;
```

---

## 12.4 `ScheduledWorkoutRepository`

Required methods:

```ts
findByDate(date: string): Promise<ScheduledWorkoutEntity[]>;
findByDateRange(startDate: string, endDate: string): Promise<ScheduledWorkoutEntity[]>;
findById(id: string): Promise<ScheduledWorkoutEntity | null>;
create(workout: ScheduledWorkoutEntity): Promise<ScheduledWorkoutEntity>;
update(workout: ScheduledWorkoutEntity): Promise<ScheduledWorkoutEntity>;
move(id: string, scheduledDate: string): Promise<ScheduledWorkoutEntity>;
copy(id: string, scheduledDate: string): Promise<ScheduledWorkoutEntity>;
delete(id: string): Promise<void>;
```

---

## 12.5 `AppSettingsRepository`

Required methods:

```ts
getSettings(): Promise<AppSettingsEntity>;
update(settings: AppSettingsEntity): Promise<AppSettingsEntity>;
createDefaultSettings(): Promise<AppSettingsEntity>;
```

---

# 13. Domain Services

## 13.1 `TrainingCalendarService`

### Purpose

Coordinate calendar-specific operations.

### Required methods

```ts
getWeekWorkouts(referenceDate: string): Promise<ScheduledWorkoutEntity[]>;
getMonthWorkouts(year: number, month: number): Promise<ScheduledWorkoutEntity[]>;
moveWorkout(workoutId: string, targetDate: string): Promise<ScheduledWorkoutEntity>;
copyWorkout(workoutId: string, targetDate: string): Promise<ScheduledWorkoutEntity>;
```

---

## 13.2 `WeeklySummaryService`

### Purpose

Calculate weekly training summary from scheduled workouts.

### Required output

```ts
interface WeeklySummary {
  startDate: string;
  endDate: string;
  totalSessions: number;
  totalDurationMinutes: number;
  restDays: number;
  sessionsByType: Record<WorkoutType, number>;
  durationByType: Record<WorkoutType, number>;
  sessionsByDiscipline: Record<WorkoutDiscipline, number>;
  durationByDiscipline: Record<WorkoutDiscipline, number>;
  intenseSessions: number;
}
```

### Rules

- Only workouts in the selected week are counted.
- `planned`, `completed`, and `skipped` can exist, but MVP summary should count planned workouts by default.
- Rest days are days with zero scheduled workouts.
- Intense sessions are workouts with type `threshold`, `vo2max`, or target zone equivalent to high intensity.

---

## 13.3 `WorkoutTemplateSchedulerService`

### Purpose

Create scheduled workouts from templates.

### Required method

```ts
scheduleTemplate(templateId: string, scheduledDate: string): Promise<ScheduledWorkoutEntity>;
```

### Rules

- The scheduled workout must receive a new ID.
- The scheduled workout must copy the template fields.
- The scheduled workout must store `sourceTemplateId`.
- The scheduled workout must be independent from the template after creation.
- Editing the scheduled workout must not affect the template.
- Editing the template must not affect already scheduled workouts.

---

# 14. Seeding Rules

## 14.1 Default profile

If no sport profile exists, create:

```ts
{
  name: 'Default Athlete',
  maxHeartRate: 193,
  preferredDiscipline: 'mixed',
  preferredIntensityMetric: 'heart_rate',
  weekStartsOn: 'monday'
}
```

Important: this is only a local default. It must be editable from settings.

## 14.2 Default training zones

If no training zones exist, create zones based on max heart rate.

Recommended initial zones:

| Zone              | % Max HR | Purpose                     |
| ----------------- | -------: | --------------------------- |
| Z1 Recovery       |   50-60% | Easy recovery               |
| Z2 Endurance      |   60-70% | Aerobic base                |
| Z3 Tempo          |   70-80% | Moderate sustained work     |
| Z4 Threshold      |   80-90% | Hard sustained work         |
| Z5 High Intensity |  90-100% | VO2 max / anaerobic efforts |

The seeded values must be calculated once and persisted.

Changing max heart rate later must not automatically rewrite all zones unless the user explicitly requests recalculation.

---

# 15. Validation Rules

## 15.1 Scheduled workout validation

A scheduled workout is valid only when:

- `title` is not empty,
- `scheduledDate` is present,
- `scheduledDate` uses `YYYY-MM-DD`,
- `estimatedDurationMinutes > 0`,
- `workoutType` is valid,
- `discipline` is valid,
- `status` is valid,
- all blocks have `durationMinutes > 0`,
- all blocks have valid `sortOrder`.

## 15.2 Template validation

A template is valid only when:

- `title` is not empty,
- it has no `scheduledDate`,
- `estimatedDurationMinutes > 0`,
- `workoutType` is valid,
- `discipline` is valid,
- all blocks have `durationMinutes > 0`.

## 15.3 Zone validation

A zone is valid only when:

- `name` is not empty,
- `minHeartRate > 0`,
- `maxHeartRate > 0`,
- `minHeartRate <= maxHeartRate`,
- `sortOrder` is present.

The system should prevent overlapping zones where possible.

---

# 16. Error Handling

## 16.1 Database unavailable

If IndexedDB cannot be opened, the app must show a clear error message.

Example:

```txt
Local storage is unavailable. Your workouts cannot be saved in this browser session.
```

## 16.2 Failed transaction

If a transaction fails, the repository must reject the Promise with a domain-friendly error.

Components should not receive raw `IDBRequest` or `DOMException` objects directly.

## 16.3 Migration failure

If migration fails, the app must not silently continue.

The app should expose a recoverable error state and avoid writing partial data.

---

# 17. Acceptance Criteria

## Scenario: Database is created on first app load

Given the user opens the application for the first time
When the app initializes storage
Then the IndexedDB database `cycling_training_planner_db` must be created
And all required object stores must exist
And default settings must be created
And default sport profile must be created
And default training zones must be created

---

## Scenario: Create a scheduled workout

Given IndexedDB is initialized
When the user creates a scheduled workout
Then the workout must be saved in `scheduled_workouts`
And it must have a unique ID
And it must include `createdAt` and `updatedAt`
And it must appear when querying workouts by its scheduled date

---

## Scenario: Query workouts by week

Given several workouts exist in IndexedDB
When the calendar requests workouts between a start date and end date
Then the repository must return only workouts within that date range
And the result must be sorted by `scheduledDate`

---

## Scenario: Move a workout

Given a scheduled workout exists
When the user moves it to another date
Then only `scheduledDate` and `updatedAt` must change
And the workout must no longer appear on the previous date
And it must appear on the new date

---

## Scenario: Copy a workout

Given a scheduled workout exists
When the user copies it to another date
Then a new workout must be created
And the new workout must have a different ID
And the original workout must remain unchanged

---

## Scenario: Schedule workout from template

Given a workout template exists
When the user schedules the template on a date
Then a scheduled workout must be created
And it must copy the template structure
And it must store `sourceTemplateId`
And future template changes must not modify the scheduled workout

---

# 18. Implementation Tasks

## 18.1 Storage foundation

- [ ] Create `indexed-db.config.ts`.
- [ ] Define database name and version.
- [ ] Create `indexed-db.types.ts`.
- [ ] Create `indexed-db.service.ts`.
- [ ] Implement database open logic.
- [ ] Implement upgrade logic.
- [ ] Create object stores.
- [ ] Create indexes.
- [ ] Add reusable transaction helpers.

## 18.2 Domain models

- [ ] Create workout enums.
- [ ] Create sport profile model.
- [ ] Create training zone model.
- [ ] Create workout block model.
- [ ] Create workout template model.
- [ ] Create scheduled workout model.
- [ ] Create app settings model.

## 18.3 Repositories

- [ ] Create `SportProfileRepository`.
- [ ] Create `TrainingZoneRepository`.
- [ ] Create `WorkoutTemplateRepository`.
- [ ] Create `ScheduledWorkoutRepository`.
- [ ] Create `AppSettingsRepository`.

## 18.4 Seed data

- [ ] Seed default app settings if missing.
- [ ] Seed default sport profile if missing.
- [ ] Seed default training zones if missing.
- [ ] Ensure seed logic is idempotent.

## 18.5 Domain services

- [ ] Create `TrainingCalendarService`.
- [ ] Create `WeeklySummaryService`.
- [ ] Create `WorkoutTemplateSchedulerService`.

## 18.6 Tests

- [ ] Test database initialization.
- [ ] Test object store creation.
- [ ] Test default seed data.
- [ ] Test scheduled workout creation.
- [ ] Test scheduled workout update.
- [ ] Test scheduled workout move.
- [ ] Test scheduled workout copy.
- [ ] Test scheduled workout deletion.
- [ ] Test weekly date range query.
- [ ] Test template scheduling.
- [ ] Test zone validation.

---

# 19. Technical Design Notes

## 19.1 Native IndexedDB vs wrapper library

For MVP, avoid putting raw IndexedDB calls throughout the codebase.

Either:

1. Use native IndexedDB only inside `IndexedDbService`, or
2. Use a wrapper library such as Dexie inside the storage layer.

Do not mix both approaches across the app.

Recommended for cleaner development:

```txt
Angular components -> Domain services -> Repositories -> IndexedDbService -> IndexedDB
```

## 19.2 Critical design decision

Do not let calendar components know about IndexedDB.

Bad:

```txt
CalendarComponent -> IndexedDB
```

Good:

```txt
CalendarComponent -> TrainingCalendarService -> ScheduledWorkoutRepository -> IndexedDbService
```

This keeps the app testable and makes future backend migration possible.

---

# 20. Future Extensions

This IndexedDB design should allow future support for:

- import/export backup as JSON,
- cloud sync,
- backend migration,
- completed workout logs,
- planned vs completed comparison,
- simple training load estimation,
- multiple sport profiles,
- offline-first synchronization.

These must not be implemented as part of this change.
