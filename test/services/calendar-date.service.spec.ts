import { WeekStartsOn } from '../../src/app/core/domain/calendar.enums';
import { CalendarDateService } from '../../src/app/core/services/calendar-date.service';

describe('CalendarDateService', () => {
  let service: CalendarDateService;

  interface CalendarDay {
    date: string;
  }
  type CalendarWeek = CalendarDay[];
  type CalendarGrid = CalendarWeek[];
  interface VisibleRange {
    startDate: string;
    endDate: string;
  }

  beforeEach(() => {
    service = new CalendarDateService();
  });

  it('genera una grilla de 6 filas para mayo de 2026 iniciando en lunes', () => {
    const weeks: CalendarGrid = service.buildMonthGrid(2026, 5, WeekStartsOn.Monday);

    expect(weeks.length).toBe(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0].date).toBe('2026-04-27');
    expect(weeks[0][4].date).toBe('2026-05-01');
  });

  it('respeta inicio de semana en lunes y domingo', () => {
    const mondayWeeks: CalendarGrid = service.buildMonthGrid(2026, 5, WeekStartsOn.Monday);
    const sundayWeeks: CalendarGrid = service.buildMonthGrid(2026, 5, WeekStartsOn.Sunday);

    expect(mondayWeeks[0][0].date).toBe('2026-04-27');
    expect(sundayWeeks[0][0].date).toBe('2026-04-26');
    expect(service.getWeekdays(WeekStartsOn.Sunday)[0]).toBe('Domingo');
  });

  it('calcula el rango visible incluyendo días de meses vecinos', () => {
    const range: VisibleRange = service.getVisibleRange(2026, 5, WeekStartsOn.Monday);

    expect(range).toEqual({ startDate: '2026-04-27', endDate: '2026-06-07' });
  });

  it('formatea la etiqueta mensual en español', () => {
    expect(service.formatMonthLabel(2026, 5)).toBe('MAYO 2026');
  });

  it('formatea duraciones', () => {
    expect((service.formatDuration as (minutes: number) => string)(0)).toBe('-- h');
    expect((service.formatDuration as (minutes: number) => string)(45)).toBe('45 min');
    expect((service.formatDuration as (minutes: number) => string)(130)).toBe('2 h 10 min');
  });

  it('formatea distancias', () => {
    expect((service.formatDistance as (km: number | null) => string)(null)).toBe('-- km');
    expect((service.formatDistance as (km: number | null) => string)(50)).toBe('50 km');
    expect((service.formatDistance as (km: number | null) => string)(50.5)).toBe('50.5 km');
  });

  it('detecta la fecha actual', () => {
    const today = service.today();

    expect(service.isToday(today)).toBe(true);
    expect(service.isToday('2026-05-01')).toBe(today === '2026-05-01');
  });

  it('calcula hoy con la zona horaria local y no con UTC', () => {
    // 27 sep 2026 a las 23:30 hora local: en zonas al oeste de UTC ya es 28 sep en UTC.
    const lateEvening = new Date(2026, 8, 27, 23, 30);

    expect(service.today(lateEvening)).toBe('2026-09-27');
  });

  it('calcula el rango de la semana según el inicio configurado', () => {
    // 2026-09-27 es domingo.
    expect(service.getWeekRange('2026-09-27', WeekStartsOn.Monday)).toEqual({
      startDate: '2026-09-21',
      endDate: '2026-09-27',
    });
    expect(service.getWeekRange('2026-09-27', WeekStartsOn.Sunday)).toEqual({
      startDate: '2026-09-27',
      endDate: '2026-10-03',
    });
    expect(service.getWeekRange('2026-10-01', WeekStartsOn.Monday)).toEqual({
      startDate: '2026-09-28',
      endDate: '2026-10-04',
    });
  });

  it('desplaza fechas entre meses y años', () => {
    expect(service.shiftDate('2026-12-29', 7)).toBe('2027-01-05');
    expect(service.shiftDate('2026-03-02', -7)).toBe('2026-02-23');
  });

  it('formatea fechas cortas en español', () => {
    expect(service.formatShortDate('2026-10-05')).toBe('5 oct');
  });

  it('detecta si una fecha pertenece al mismo mes', () => {
    expect(
      (service.isSameMonth as (date: string, y: number, m: number) => boolean)(
        '2026-05-01',
        2026,
        5,
      ),
    ).toBe(true);
    expect(
      (service.isSameMonth as (date: string, y: number, m: number) => boolean)(
        '2026-06-01',
        2026,
        5,
      ),
    ).toBe(false);
  });

  it('calcula la semana ISO de una fecha y de una semana por su inicio', () => {
    expect(service.getWeekNumber('2026-05-04')).toBe(19);
    expect(service.getWeekNumber('2026-05-10')).toBe(19);
    expect(service.getWeekNumber('2026-01-01')).toBe(1);
    expect(service.getWeekNumber('2021-01-03')).toBe(53);
    expect(service.getWeekNumberFromStart('2026-05-04')).toBe(19);
    // A week that starts on Sunday takes the number of the Monday-based week that contains Wednesday.
    expect(service.getWeekNumberFromStart('2026-05-03')).toBe(19);
  });

  it('da formato al rango de la semana para el encabezado', () => {
    expect(service.formatLongRange('2026-05-04', '2026-05-10')).toBe('4 – 10 de mayo de 2026');
    expect(service.formatLongRange('2026-04-27', '2026-05-03')).toBe('27 abr – 3 may 2026');
    expect(service.formatLongRange('2025-12-29', '2026-01-04')).toBe('29 dic 2025 – 4 ene 2026');
  });
});
