import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, Lock, Mail } from 'lucide-react';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

const collectRecoveryParams = () => {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.slice(1);

  const mergeParams = (raw: string) => {
    const cleaned = raw.replace(/^[#?&]/, '');
    if (!cleaned) return;

    new URLSearchParams(cleaned).forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  };

  const queryIndex = hash.indexOf('?');
  if (queryIndex >= 0) mergeParams(hash.slice(queryIndex + 1));

  const nestedHashIndex = hash.indexOf('#');
  if (nestedHashIndex >= 0) mergeParams(hash.slice(nestedHashIndex + 1));

  const tokenStarts = ['access_token=', 'refresh_token=', 'code=']
    .map((marker) => hash.indexOf(marker))
    .filter((index) => index >= 0);

  if (tokenStarts.length > 0) {
    mergeParams(hash.slice(Math.min(...tokenStarts)));
  }

  return {
    code: params.get('code'),
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
  };
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sessionEmail, setSessionEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  const getRecoveryErrorMessage = (error: unknown) => {
    const message = getErrorMessage(error, '');
    if (/auth session missing|invalid|expired/i.test(message)) {
      return 'Link de redefinição inválido ou expirado. Solicite um novo link pela tela de login.';
    }
    return message || 'Não foi possível validar o link de redefinição.';
  };

  useEffect(() => {
    let active = true;

    const prepareRecoverySession = async () => {
      setIsVerifying(true);
      setRecoveryError('');

      try {
        const { code, accessToken, refreshToken } = collectRecoveryParams();

        if (code) {
          const { error } = await externalSupabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await externalSupabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        const { data, error } = await externalSupabase.auth.getUser();
        if (error || !data.user) {
          throw error ?? new Error('Link de redefinição inválido ou expirado.');
        }

        if (!active) return;

        const recoveredEmail = data.user.email ?? '';
        setSessionEmail(recoveredEmail);
        setEmail(recoveredEmail);
      } catch (error) {
        if (!active) return;
        setRecoveryError(getRecoveryErrorMessage(error));
      } finally {
        if (active) setIsVerifying(false);
      }
    };

    prepareRecoverySession();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    const cleanSessionEmail = sessionEmail.trim().toLowerCase();

    if (!cleanEmail) {
      toast({
        title: 'E-mail obrigatório',
        description: 'Informe o e-mail da conta que está redefinindo a senha.',
        variant: 'destructive',
      });
      return;
    }

    if (cleanSessionEmail && cleanEmail !== cleanSessionEmail) {
      toast({
        title: 'E-mail diferente do link',
        description: 'Use o mesmo e-mail que recebeu o link de redefinição.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A nova senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'Digite a mesma senha nos dois campos.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await externalSupabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      await externalSupabase.auth.signOut();

      toast({
        title: 'Senha redefinida',
        description: 'Entre novamente usando sua nova senha.',
      });

      navigate('/login', { replace: true });
    } catch (error) {
      toast({
        title: 'Erro ao redefinir senha',
        description: getErrorMessage(error, 'Não foi possível salvar sua nova senha.'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src={`${import.meta.env.BASE_URL}LogoNovo.svg`}
              alt="Logo"
              className="h-20 w-20 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-primary">TechNET</h1>
          <p className="text-muted-foreground mt-2">Redefinição de senha</p>
        </div>

        <Card className="border-border/50 shadow-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="h-5 w-5 text-primary" />
              Criar nova senha
            </CardTitle>
            <CardDescription>
              Confirme o e-mail da conta e informe a nova senha duas vezes.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isVerifying ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Validando link de recuperação...
              </div>
            ) : recoveryError ? (
              <div className="space-y-4">
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {recoveryError}
                </div>
                <Button type="button" className="w-full" onClick={() => navigate('/login')}>
                  Voltar para o login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="pl-10"
                      placeholder="seu@email.com"
                      autoComplete="email"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="pl-10"
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="pl-10"
                      placeholder="Repita a nova senha"
                      autoComplete="new-password"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Redefinir senha
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
