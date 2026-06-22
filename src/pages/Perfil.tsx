import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Bell,
    Briefcase,
    Camera,
    CheckCircle2,
    ExternalLink,
    KeyRound,
    Loader2,
    Mail,
    RefreshCw,
    Save,
    Shield,
    User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/useNotifications';

const Perfil: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { profile, refreshProfile, user } = useAuth();
    const { toast } = useToast();
    const photoInputRef = useRef<HTMLInputElement>(null);
    const [displayName, setDisplayName] = useState('');
    const [cargo, setCargo] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const {
        items: notificationItems,
        totalUnread,
        isLoading: isLoadingNotifications,
        isMarkingSeen,
        error: notificationsError,
        lastSeenAt,
        refresh: refreshNotifications,
        markAsSeen,
    } = useNotifications();

    useEffect(() => {
        setDisplayName(profile?.display_name || '');
        setCargo(profile?.cargo || '');
    }, [profile?.cargo, profile?.display_name]);

    const cleanDisplayName = displayName.trim();
    const cleanCargo = cargo.trim();
    const currentDisplayName = (profile?.display_name || '').trim();
    const currentCargo = (profile?.cargo || '').trim();
    const hasProfileChanges = cleanDisplayName !== currentDisplayName || cleanCargo !== currentCargo;
    const canSaveProfile = cleanDisplayName.length > 0 && hasProfileChanges && !isSavingProfile;
    const canSavePassword =
        passwordForm.newPassword.length > 0 &&
        passwordForm.confirmPassword.length > 0 &&
        !isSavingPassword;
    const name = currentDisplayName || profile?.email || user?.email || 'Usuário';
    const initials = name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || 'U';
    const profileTypeLabel = profile?.role === 'admin' ? 'Administrador' : 'Usuário';
    const cargoLabel = currentCargo || 'Cargo não informado';
    const activeTab = searchParams.get('tab') === 'senha' || searchParams.get('tab') === 'notif'
        ? searchParams.get('tab')!
        : 'dados';
    const lastSeenLabel = lastSeenAt
        ? new Date(lastSeenAt).toLocaleString('pt-BR')
        : 'últimas 24 horas';

    const getErrorMessage = (error: unknown, fallback: string) =>
        error instanceof Error ? error.message : fallback;

    const handleTabChange = (value: string) => {
        const nextParams = new URLSearchParams(searchParams);
        if (value === 'dados') {
            nextParams.delete('tab');
        } else {
            nextParams.set('tab', value);
        }
        setSearchParams(nextParams, { replace: true });
    };

    const getAvatarExtension = (file: File) => {
        if (file.type === 'image/png') return 'png';
        if (file.type === 'image/webp') return 'webp';
        return 'jpg';
    };

    const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        if (!user?.id) {
            toast({
                title: 'Sessão não encontrada',
                description: 'Entre novamente para alterar sua foto.',
                variant: 'destructive',
            });
            return;
        }

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast({
                title: 'Formato inválido',
                description: 'Use uma imagem JPG, PNG ou WEBP.',
                variant: 'destructive',
            });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast({
                title: 'Imagem muito grande',
                description: 'Escolha uma imagem de até 5 MB.',
                variant: 'destructive',
            });
            return;
        }

        setIsUploadingPhoto(true);
        try {
            const extension = getAvatarExtension(file);
            const avatarPath = `${user.id}/avatar.${extension}`;
            const { error: uploadError } = await externalSupabase.storage
                .from('profile-photos')
                .upload(avatarPath, file, {
                    cacheControl: '3600',
                    contentType: file.type,
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data } = externalSupabase.storage
                .from('profile-photos')
                .getPublicUrl(avatarPath);

            const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
            const { error: profileError } = await externalSupabase
                .from('profiles')
                .update({
                    avatar_path: avatarPath,
                    avatar_url: avatarUrl,
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            await refreshProfile();
            toast({
                title: 'Foto atualizada',
                description: 'Sua foto de perfil foi salva com sucesso.',
            });
        } catch (error) {
            toast({
                title: 'Erro ao alterar foto',
                description: getErrorMessage(error, 'Não foi possível salvar sua foto.'),
                variant: 'destructive',
            });
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!user?.id) {
            toast({
                title: 'Sessão não encontrada',
                description: 'Entre novamente para atualizar seu perfil.',
                variant: 'destructive',
            });
            return;
        }

        if (!cleanDisplayName) {
            toast({
                title: 'Nome obrigatório',
                description: 'Informe seu nome completo para salvar.',
                variant: 'destructive',
            });
            return;
        }

        setIsSavingProfile(true);
        try {
            const { error } = await externalSupabase
                .from('profiles')
                .update({
                    display_name: cleanDisplayName,
                    cargo: cleanCargo || null,
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshProfile();
            toast({
                title: 'Perfil atualizado',
                description: 'Suas informações foram salvas com sucesso.',
            });
        } catch (error) {
            toast({
                title: 'Erro ao salvar perfil',
                description: getErrorMessage(error, 'Não foi possível atualizar seu perfil.'),
                variant: 'destructive',
            });
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (passwordForm.newPassword.length < 6) {
            toast({
                title: 'Senha muito curta',
                description: 'A nova senha deve ter pelo menos 6 caracteres.',
                variant: 'destructive',
            });
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast({
                title: 'Senhas não conferem',
                description: 'Digite a mesma senha nos dois campos.',
                variant: 'destructive',
            });
            return;
        }

        setIsSavingPassword(true);
        try {
            const { error } = await externalSupabase.auth.updateUser({
                password: passwordForm.newPassword,
            });

            if (error) throw error;

            setPasswordForm({ newPassword: '', confirmPassword: '' });
            toast({
                title: 'Senha atualizada',
                description: 'Sua senha foi alterada com sucesso.',
            });
        } catch (error) {
            toast({
                title: 'Erro ao alterar senha',
                description: getErrorMessage(error, 'Não foi possível atualizar sua senha.'),
                variant: 'destructive',
            });
        } finally {
            setIsSavingPassword(false);
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto p-8 space-y-6">
            <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Perfil</p>
                <h1 className="text-2xl font-extrabold text-foreground">Meu Perfil</h1>
                <p className="text-sm text-muted-foreground">Gerencie suas informações pessoais e preferências</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
                <Card className="p-6 flex flex-col items-center text-center gap-3">
                    <div className="w-28 h-28 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-extrabold shadow-glow overflow-hidden">
                        {profile?.avatar_url ? (
                            <img
                                src={profile.avatar_url}
                                alt={`Foto de ${name}`}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            initials
                        )}
                    </div>
                    <div>
                        <div className="text-lg font-bold text-foreground">{name}</div>
                        <div className="text-sm text-muted-foreground">{profileTypeLabel}</div>
                    </div>

                    <div className="w-full space-y-2 mt-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4" /> {profile?.email || user?.email || '-'}</div>
                        <div className="flex items-center gap-2 text-muted-foreground"><Briefcase className="w-4 h-4" /> {cargoLabel}</div>
                        <div className="flex items-center gap-2 text-muted-foreground"><Shield className="w-4 h-4" /> Perfil: {profileTypeLabel}</div>
                    </div>

                    <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handlePhotoChange}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full mt-4"
                        disabled={isUploadingPhoto}
                        onClick={() => photoInputRef.current?.click()}
                    >
                        {isUploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        Alterar Foto
                    </Button>
                </Card>

                <Card className="p-6">
                    <Tabs value={activeTab} onValueChange={handleTabChange}>
                        <TabsList className="grid grid-cols-3 w-full">
                            <TabsTrigger value="dados" className="gap-2"><UserIcon className="w-4 h-4" /> Dados Pessoais</TabsTrigger>
                            <TabsTrigger value="senha" className="gap-2"><Shield className="w-4 h-4" /> Senha</TabsTrigger>
                            <TabsTrigger value="notif" className="gap-2">
                                <Bell className="w-4 h-4" />
                                Notificações
                                {totalUnread > 0 && (
                                    <span className="ml-1 min-w-5 h-5 rounded-full bg-destructive px-1 text-[10px] font-bold leading-5 text-destructive-foreground">
                                        {totalUnread > 99 ? '99+' : totalUnread}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="dados" className="mt-6">
                            <form className="space-y-4" onSubmit={handleProfileSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="display-name">Nome Completo</Label>
                                        <Input
                                            id="display-name"
                                            value={displayName}
                                            onChange={(event) => setDisplayName(event.target.value)}
                                            placeholder="Digite seu nome completo"
                                            autoComplete="name"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="profile-email">E-mail</Label>
                                        <Input id="profile-email" value={profile?.email || user?.email || ''} disabled />
                                        <p className="text-[11px] text-muted-foreground">O e-mail não pode ser alterado</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="profile-cargo">Cargo</Label>
                                        <Input
                                            id="profile-cargo"
                                            value={cargo}
                                            onChange={(event) => setCargo(event.target.value)}
                                            placeholder="Ex.: Financeiro"
                                            autoComplete="organization-title"
                                        />
                                        <p className="text-[11px] text-muted-foreground">Esse cargo aparece no seu perfil.</p>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button type="submit" disabled={!canSaveProfile}>
                                        {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Salvar Alterações
                                    </Button>
                                </div>
                            </form>
                        </TabsContent>

                        <TabsContent value="senha" className="mt-6">
                            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="new-password">Nova senha</Label>
                                        <Input
                                            id="new-password"
                                            type="password"
                                            value={passwordForm.newPassword}
                                            onChange={(event) => setPasswordForm(prev => ({ ...prev, newPassword: event.target.value }))}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                                        <Input
                                            id="confirm-password"
                                            type="password"
                                            value={passwordForm.confirmPassword}
                                            onChange={(event) => setPasswordForm(prev => ({ ...prev, confirmPassword: event.target.value }))}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button type="submit" disabled={!canSavePassword}>
                                        {isSavingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                                        Atualizar Senha
                                    </Button>
                                </div>
                            </form>
                        </TabsContent>
                        <TabsContent value="notif" className="mt-6">
                            <div className="space-y-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h2 className="text-base font-semibold text-foreground">Central de Notificações</h2>
                                        <p className="text-sm text-muted-foreground">
                                            Novidades desde {lastSeenLabel}.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={refreshNotifications}
                                            disabled={isLoadingNotifications}
                                        >
                                            {isLoadingNotifications ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                            Atualizar
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={async () => {
                                                try {
                                                    await markAsSeen();
                                                    toast({
                                                        title: 'Notificações atualizadas',
                                                        description: 'Os avisos de novos dados foram marcados como lidos.',
                                                    });
                                                } catch (error) {
                                                    toast({
                                                        title: 'Erro ao atualizar notificações',
                                                        description: getErrorMessage(error, 'Não foi possível marcar as notificações como lidas.'),
                                                        variant: 'destructive',
                                                    });
                                                }
                                            }}
                                            disabled={isMarkingSeen || totalUnread === 0}
                                        >
                                            {isMarkingSeen ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                            Marcar como lidas
                                        </Button>
                                    </div>
                                </div>

                                {notificationsError && (
                                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                        {notificationsError}
                                    </div>
                                )}

                                {notificationItems.length === 0 ? (
                                    <div className="flex items-center gap-3 rounded-md border border-border px-4 py-5 text-sm text-muted-foreground">
                                        <CheckCircle2 className="w-5 h-5 text-success" />
                                        Nenhuma notificação nova no momento.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border rounded-md border border-border">
                                        {notificationItems.map((item) => (
                                            <div key={item.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <Bell className="w-4 h-4 text-primary" />
                                                        <span className="font-semibold text-foreground">{item.title}</span>
                                                        <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
                                                            {item.count}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => navigate(item.href)}
                                                    className="shrink-0"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                    Abrir
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </Card>
            </div>
        </div>
    );
};

export default Perfil;
