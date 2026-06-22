import React from 'react';
import { DollarSign, Calendar, LogOut, Shield, Sun, Moon, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export const ComissionamentoHeader: React.FC = () => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = profile?.role === 'admin';

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-8 py-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-glow"
            style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">SOLICITAÇÃO DE PAGAMENTO</h1>
            <p className="text-sm text-muted-foreground font-medium">Controle de Pagamento</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="w-4 h-4" />
              <span className="capitalize">{currentDate}</span>
            </div>
            {profile?.display_name && (
              <span className="text-xs font-semibold text-foreground">
                {profile.display_name}
              </span>
            )}
          </div>
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="gap-2">
              <Shield className="w-4 h-4" /> Admin
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm"
            onClick={async () => { await signOut(); navigate('/login'); }}
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
      </div>
    </header>
  );
};