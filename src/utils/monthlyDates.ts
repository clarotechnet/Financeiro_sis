export const MAX_MONTHLY_OCCURRENCES = 60;

export const clampMonthlyOccurrences = (value: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_MONTHLY_OCCURRENCES, Math.max(1, Math.trunc(value)));
};

export const addMonthsPreservingDay = (dateValue: string, monthOffset: number) => {
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) return dateValue;

  const targetMonth = new Date(year, month - 1 + monthOffset, 1);
  const targetYear = targetMonth.getFullYear();
  const targetMonthIndex = targetMonth.getMonth();
  const lastDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();

  return [
    String(targetYear).padStart(4, '0'),
    String(targetMonthIndex + 1).padStart(2, '0'),
    String(Math.min(day, lastDay)).padStart(2, '0'),
  ].join('-');
};

export const buildMonthlyDates = (dateValue: string, occurrences: number) =>
  Array.from(
    { length: clampMonthlyOccurrences(occurrences) },
    (_, index) => addMonthsPreservingDay(dateValue, index),
  );
