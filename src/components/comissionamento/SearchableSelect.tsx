import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OpcaoSelect } from '@/types/comissionamento';

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: OpcaoSelect[];
  required?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  options,
  required = true,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(option => option.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const filteredOptions = options.filter(option =>
    option.nome.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className={`space-y-1 relative ${open ? 'z-50' : 'z-auto'}`} ref={ref}>
      <Label className="text-sm font-medium">{label} {required && '*'}</Label>
      <button
        type="button"
        className={`w-full bg-card border rounded-lg px-3 py-2 text-left text-sm text-foreground flex items-center justify-between gap-2 ${open ? 'border-primary' : 'border-border'}`}
        onClick={() => setOpen(prev => !prev)}
      >
        <span className={selectedOption ? 'truncate' : 'text-muted-foreground truncate'}>
          {selectedOption?.nome || 'Selecione...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <div className="relative border-b border-border">
            <Input
              className="h-9 rounded-none border-0 pr-9 focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Buscar..."
              value={search}
              onChange={event => setSearch(event.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {selectedOption && (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setSearch('');
                }}
              >
                <X className="w-4 h-4" />
                Limpar seleção
              </button>
            )}

            {filteredOptions.map(option => (
              <button
                key={option.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <span className={`h-4 w-4 rounded border border-border ${value === option.id ? 'bg-primary border-primary' : ''}`} />
                <span>{option.nome}</span>
              </button>
            ))}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
