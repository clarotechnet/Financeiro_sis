import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, LogOut, Sun, Moon, User, Settings, ChevronDown } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';

export const AppHeader: React.FC = () => {
    const navigate = useNavigate();
    const { signOut, profile, isAdmin } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { totalUnread } = useNotifications();

    const currentDate = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const displayName = profile?.display_name || profile?.email || 'Usuário';
    const initials = displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(s => s[0]?.toUpperCase())
        .join('') || 'U';
    const profileTypeLabel = profile?.role === 'admin' ? 'Administrador' : 'RH';
    const canAccessSettings = isAdmin || profile?.role === 'rh';

    return (
        <header className="h-16 border-b border-border bg-surface/80 backdrop-blur-xl sticky top-0 z-40 flex items-center px-4 gap-3">
            <SidebarTrigger className="text-foreground" />

            <div className="hidden md:flex items-center gap-2 text-muted-foreground text-sm ml-2">
                <Calendar className="w-4 h-4" />
                <span className="capitalize">{currentDate}</span>
            </div>

            <div className="flex-1" />

            <Button variant="ghost" size="icon" onClick={toggleTheme} title="Alternar tema">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/perfil?tab=notif')}
                title="Notificações"
                className="relative"
            >
                <Bell className="w-4 h-4" />
                {totalUnread > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-5 h-5 rounded-full bg-destructive px-1 text-[10px] font-bold leading-5 text-destructive-foreground">
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                )}
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors">
                        <Avatar className="w-9 h-9 ring-1 ring-border">
                            <AvatarImage src={profile?.avatar_url || undefined} alt={`Foto de ${displayName}`} className="object-cover" />
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="hidden sm:flex flex-col items-start leading-tight">
                            <span className="text-sm font-semibold text-foreground max-w-[160px] truncate">{displayName}</span>
                            <span className="text-[11px] text-muted-foreground">{profileTypeLabel}</span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/perfil')} className="gap-2 cursor-pointer">
                        <User className="w-4 h-4" /> Perfil
                    </DropdownMenuItem>
                    {canAccessSettings && (
                        <DropdownMenuItem onClick={() => navigate('/configuracoes')} className="gap-2 cursor-pointer">
                            <Settings className="w-4 h-4" /> Configurações
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={async () => { await signOut(); navigate('/login'); }}
                        className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    >
                        <LogOut className="w-4 h-4" /> Sair
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
};

export default AppHeader;
