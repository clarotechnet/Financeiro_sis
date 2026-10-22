import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface DepartmentFilterOption {
  value: string;
  label: string;
}

interface DepartmentFilterSelectProps {
  label: string;
  options: DepartmentFilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function DepartmentFilterSelect({ label, options, selected, onChange }: DepartmentFilterSelectProps) {
  const id = useId();
  const [search, setSearch] = useState('');
  const filteredOptions = options.filter(option =>
    option.label.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
  );
  const displayValue = selected.length === 0
    ? 'Todos'
    : selected.length === 1
      ? options.find(option => option.value === selected[0])?.label || selected[0]
      : `${selected.length} selecionado(s)`;

  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Popover onOpenChange={() => setSearch('')}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className="h-9 w-full justify-between gap-2 font-normal">
            <span className="truncate" title={displayValue}>{displayValue}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
          <div className="border-b p-2">
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar..."
              aria-label={`Buscar ${label.toLocaleLowerCase('pt-BR')}`}
              className="h-8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {selected.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="w-full rounded-sm px-2 py-2 text-left text-sm text-muted-foreground hover:bg-accent">
                Limpar seleção
              </button>
            )}
            {filteredOptions.map(option => (
              <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent">
                <Checkbox
                  checked={selected.includes(option.value)}
                  onCheckedChange={checked => onChange(checked === true
                    ? [...selected, option.value]
                    : selected.filter(value => value !== option.value))}
                />
                <span className="min-w-0 break-words">{option.label}</span>
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
