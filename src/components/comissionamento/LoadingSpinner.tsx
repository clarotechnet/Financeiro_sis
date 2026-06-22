import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  message?: string;
}

export const LoadingSpinner: React.FC<Props> = ({ message = 'Carregando...' }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-3">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);
