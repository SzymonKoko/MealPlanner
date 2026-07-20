export function keepDateRangeOrdered(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo && dateFrom > dateTo) return dateFrom;
  return dateTo;
}
