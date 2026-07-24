import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Loader2, LogIn, UserPlus, Mail, Lock, User, KeyRound } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp, requestPasswordReset, user, isLoading: authLoading, isApproved } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  
  // Signup form
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (!authLoading && user && isApproved) {
      navigate('/', { replace: true });
    }
  }, [user, isApproved, authLoading, navigate]);

  // Limpa campos ao montar componente (para quando voltar da sessão)
  useEffect(() => {
    setLoginEmail('');
    setLoginPassword('');
    setSignupEmail('');
    setSignupPassword('');
    setSignupConfirmPassword('');
    setDisplayName('');
    setForgotEmail('');
  }, []);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha email e senha.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    setLoginEmail('');
    setLoginPassword('');


    if (result.ok) {
      toast({
        title: 'Bem-vindo!',
        description: result.message,
      });
       // Força navegação imediata
      navigate('/', { replace: true });

    } else {
      toast({
        title: result.reason === 'PENDENTE' ? 'Acesso Pendente' : 'Erro no login',
        description: result.message,
        variant: result.reason === 'PENDENTE' ? 'default' : 'destructive',
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signupEmail || !signupPassword || !signupConfirmPassword) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'A senha e confirmação devem ser iguais.',
        variant: 'destructive',
      });
      return;
    }

    if (signupPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await signUp(signupEmail, signupPassword, displayName);
    setIsLoading(false);

     // Limpa os campos sempre após tentativa
    setSignupEmail('');
    setSignupPassword('');
    setSignupConfirmPassword('');
    setDisplayName('');


    if (result.ok) {
      toast({
        title: 'Cadastro realizado!',
        description: result.message,
      });
    } else {
      toast({
        title: 'Erro no cadastro',
        description: result.message,
        variant: 'destructive',
      });
    }
  };
  // Mostra loading enquanto verifica autenticação
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail) {
      toast({
        title: 'E-mail obrigatório',
        description: 'Informe o e-mail para receber o link de redefinição.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await requestPasswordReset(cleanEmail);
    setIsLoading(false);

    if (result.ok) {
      toast({
        title: 'Verifique seu e-mail',
        description: result.message,
      });
      setForgotEmail('');
      setActiveTab('login');
    } else {
      toast({
        title: 'Erro ao enviar link',
        description: result.message,
        variant: 'destructive',
      });
    }
  };

  const openForgotPassword = () => {
    setForgotEmail(loginEmail);
    setActiveTab('forgot');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
            <img 
              src={`${import.meta.env.BASE_URL}LogoNovo.svg`}
              alt="Logo" 
              className="h-20 w-20 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-primary">
            TechNET
          </h1>

          <p className="text-muted-foreground mt-2">
            Sistema de gestão Financeiro
          </p>
        </div>

        <Card className="border-border/50 shadow-glow">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Cadastrar
                </TabsTrigger>
                <TabsTrigger value="forgot" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Recuperar
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              {/* Login Tab */}
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <CardTitle className="text-xl text-center">Bem-vindo de volta</CardTitle>
                  <CardDescription>
                    Entre com suas credenciais para acessar o sistema.
                  </CardDescription>

                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10"
                        disabled={isLoading}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="login-password">Senha</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto px-0 py-0 text-xs text-muted-foreground hover:text-primary"
                        onClick={openForgotPassword}
                        disabled={isLoading}
                      >
                        Esqueci minha senha
                      </Button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="********"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-10"
                        disabled={isLoading}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Entrar
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <CardTitle className="text-xl">Criar conta</CardTitle>
                  <CardDescription>
                    Cadastre-se para solicitar acesso ao sistema.
                  </CardDescription>

                  <div className="space-y-2">
                    <Label htmlFor="display-name">Nome</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="display-name"
                        type="text"
                        placeholder="Nome Completo"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="pl-10"
                        disabled={isLoading}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="pl-10"
                        disabled={isLoading}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="pl-10"
                        disabled={isLoading}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Repita a senha"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className="pl-10"
                        disabled={isLoading}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cadastrando...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Solicitar acesso
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    após o cadastro, um administrador precisará aprovar seu acesso.
                  </p>
                </form>
              </TabsContent>

              {/* Forgot Password Tab */}
              <TabsContent value="forgot" className="mt-0">
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <CardTitle className="text-xl text-center">Recuperar senha</CardTitle>
                  <CardDescription>
                    Digite seu e-mail para receber um link seguro de redefinição.
                  </CardDescription>

                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="pl-10"
                        disabled={isLoading}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <KeyRound className="mr-2 h-4 w-4" />
                        Enviar link de recuperação
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setActiveTab('login')}
                    disabled={isLoading}
                  >
                    Voltar para o login
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
