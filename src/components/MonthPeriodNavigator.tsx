import React from 'react';
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface MonthPeriodNavigatorProps {
  startDate: string;
  endDate: string;
  onChange: (period: { startDate: string; endDate: string }) => void;
  label?: string;
}

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getMonthPeriod = (date: Date) => ({
  startDate: formatDateInput(new Date(date.getFullYear(), date.getMonth(), 1)),
  endDate: formatDateInput(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
});

export const MonthPeriodNavigator: React.FC<MonthPeriodNavigatorProps> = ({
  startDate,
  endDate,
  onChange,
  label = 'Período',
}) => {
  const selectRelativeMonth = (offset: number) => {
    const base = parseDateInput(startDate) || parseDateInput(endDate) || new Date();
    onChange(getMonthPeriod(new Date(base.getFullYear(), base.getMonth() + offset, 1)));
  };

  return (
    <div className="form-group">
      <Label className="form-label">{label}</Label>
      <div className="flex w-full items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => selectRelativeMonth(-1)}
          title="Mês anterior"
          aria-label="Mês anterior"
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(getMonthPeriod(new Date()))}
          className="min-w-0 flex-1 gap-2 whitespace-nowrap"
        >
          <CalendarDays className="h-4 w-4 shrink-0" /> Mês atual
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => selectRelativeMonth(1)}
          title="Mês seguinte"
          aria-label="Mês seguinte"
          className="shrink-0"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
