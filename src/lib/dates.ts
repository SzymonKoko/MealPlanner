import {
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  parseISO,
  isValid,
} from "date-fns";
import { pl } from "date-fns/locale";

export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekEnd(date: Date = new Date()): Date {
  return endOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekDays(date: Date = new Date()): Date[] {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatDateISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  return format(d, "EEEE, d MMMM", { locale: pl });
}

export function formatShortDay(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  return format(d, "EEE", { locale: pl });
}

export function parseDateParam(value: string): Date | null {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}
