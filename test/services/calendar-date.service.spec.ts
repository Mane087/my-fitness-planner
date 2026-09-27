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
    const today: string = service.formatDateOnly(new Date());

    expect((service.isToday as (date: string) => boolean)(today)).toBe(true);
    expect((service.isToday as (date: string) => boolean)('2026-05-01')).toBe(
      today === '2026-05-01',
    );
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
});
