import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Users,
  UserCheck,
  Clock,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Search,
  Shield,
  Upload,
} from 'lucide-react';

interface PendingUser {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
}

interface AllUser {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
}

interface RegistroDados {
  id: string;
  nome: string | null;
  cpf: string | null;
  setor: string | null;
  created_at: string;
  updated_at: string | null;
}

type ProfileRole = 'rh' | 'admin';
type ExcelRow = Record<string, unknown>;

const REGISTROS_TEMPLATE_HEADERS = ['nome', 'cpf', 'setor'];

const getProfileRole = (role: string | null | undefined): ProfileRole =>
  role === 'admin' ? 'admin' : 'rh';

const normalizeExcelKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const getExcelValue = (row: ExcelRow, key: string) => {
  const entry = Object.entries(row).find(([column]) => normalizeExcelKey(column) === key);
  return entry?.[1] == null ? '' : String(entry[1]).trim();
};

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading, user, profile } = useAuth();

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [registrosDados, setRegistrosDados] = useState<RegistroDados[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRegistros, setIsLoadingRegistros] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [savingRegistroId, setSavingRegistroId] = useState<string | null>(null);
  const [isImportingRegistros, setIsImportingRegistros] = useState(false);
  const [registroSearch, setRegistroSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRh = profile?.role === 'rh';
  const canAccessDepartment = isAdmin || isRh;
  const canEditDepartment = isAdmin || isRh;

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Buscar usuários pendentes
      const { data: pending, error: pendingError } = await externalSupabase
        .from('pending_users')
        .select('*')
        .order('created_at', { ascending: true });

      if (pendingError) throw pendingError;
      setPendingUsers(pending || []);

      // Buscar todos os usuários
      const { data: all, error: allError } = await externalSupabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (allError) throw allError;
      setAllUsers(all || []);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a lista de usuários.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRegistrosDados = useCallback(async () => {
    if (!canAccessDepartment) {
      setRegistrosDados([]);
      setIsLoadingRegistros(false);
      return;
    }

    setIsLoadingRegistros(true);
    try {
      const { data, error } = await externalSupabase
        .from('registros_dados')
        .select('id,nome,cpf,setor,created_at,updated_at')
        .order('nome', { ascending: true });

      if (error) throw error;
      setRegistrosDados(data || []);
    } catch (error) {
      console.error('Erro ao buscar registros do departamento pessoal:', error);
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar os registros do departamento pessoal.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingRegistros(false);
    }
  }, [canAccessDepartment]);

  useEffect(() => {
    if (authLoading) return;

    if (!canAccessDepartment) {
      navigate('/');
      return;
    }

    if (isAdmin) {
      fetchUsers();
    } else {
      setPendingUsers([]);
      setAllUsers([]);
      setIsLoading(false);
    }

    fetchRegistrosDados();
  }, [authLoading, canAccessDepartment, isAdmin, navigate, fetchUsers, fetchRegistrosDados]);

  const approveUser = async (userId: string) => {
    setApprovingId(userId);
    try {
      const { error } = await externalSupabase
        .from('profiles')
        .update({
          approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Usuário aprovado!',
        description: 'O usuário agora pode acessar o sistema.',
      });

      fetchUsers();
    } catch (error) {
      console.error('Erro ao aprovar usuário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível aprovar o usuário.',
        variant: 'destructive',
      });
    } finally {
      setApprovingId(null);
    }
  };

  const revokeAccess = async (userId: string) => {
    if (userId === user?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode revogar seu próprio acesso.',
        variant: 'destructive',
      });
      return;
    }

    setApprovingId(userId);
    try {
      const { error } = await externalSupabase
        .from('profiles')
        .update({
          approved: false,
          approved_at: null,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Acesso revogado',
        description: 'O usuário não poderá mais acessar o sistema.',
      });

      fetchUsers();
    } catch (error) {
      console.error('Erro ao revogar acesso:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível revogar o acesso.',
        variant: 'destructive',
      });
    } finally {
      setApprovingId(null);
    }
  };
  const changeRole = async (userId: string, newRole: ProfileRole) => {
    if (userId === user?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode alterar seu próprio tipo.',
        variant: 'destructive',
      });
      return;
    }

    setApprovingId(userId);
    try {
      const { error } = await externalSupabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Tipo atualizado',
        description: `Usuário agora é ${newRole}.`,
      });

      fetchUsers();
    } catch (error) {
      console.error('Erro ao alterar tipo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o tipo do usuário.',
        variant: 'destructive',
      });
    } finally {
      setApprovingId(null);
    }
  };

  const updateRegistroField = (
    id: string,
    field: 'nome' | 'cpf' | 'setor',
    value: string,
  ) => {
    setRegistrosDados(prev =>
      prev.map(registro =>
        registro.id === id ? { ...registro, [field]: value } : registro,
      ),
    );
  };

  const saveRegistro = async (registro: RegistroDados) => {
    if (!canEditDepartment) return;

    const nome = (registro.nome || '').trim();
    const cpf = (registro.cpf || '').trim();
    const setor = (registro.setor || '').trim();

    if (!nome || !cpf || !setor) {
      toast({
        title: 'Campos obrigatorios',
        description: 'Preencha nome, CPF e setor antes de salvar.',
        variant: 'destructive',
      });
      return;
    }

    setSavingRegistroId(registro.id);
    try {
      const { error } = await externalSupabase
        .from('registros_dados')
        .update({
          nome,
          cpf,
          setor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', registro.id);

      if (error) throw error;

      toast({
        title: 'Registro atualizado',
        description: 'Os dados do tecnico foram salvos.',
      });
      fetchRegistrosDados();
    } catch (error) {
      console.error('Erro ao salvar registro do departamento pessoal:', error);
      toast({
        title: 'Erro',
        description: 'Nao foi possivel salvar o registro.',
        variant: 'destructive',
      });
    } finally {
      setSavingRegistroId(null);
    }
  };

  const downloadRegistrosTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([REGISTROS_TEMPLATE_HEADERS]);
    worksheet['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 32 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'registros_dados');
    XLSX.writeFile(workbook, 'modelo_departamento_pessoal.xlsx');
  };

  const importRegistrosExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !canEditDepartment) return;

    setIsImportingRegistros(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
        defval: '',
        raw: false,
      });

      const registros = rows
        .map(row => ({
          nome: getExcelValue(row, 'nome'),
          cpf: getExcelValue(row, 'cpf').replace(/\D/g, ''),
          setor: getExcelValue(row, 'setor'),
        }))
        .filter(row => row.nome && row.cpf && row.setor);

      if (registros.length === 0) {
        toast({
          title: 'Planilha sem dados validos',
          description: 'Use as colunas nome, cpf e setor no arquivo de importacao.',
          variant: 'destructive',
        });
        return;
      }

      const chunkSize = 500;
      for (let index = 0; index < registros.length; index += chunkSize) {
        const chunk = registros.slice(index, index + chunkSize);
        const { error } = await externalSupabase.from('registros_dados').insert(chunk);
        if (error) throw error;
      }

      const ignoredRows = rows.length - registros.length;
      toast({
        title: 'Importacao concluida',
        description: `${registros.length} tecnico(s) importado(s)${ignoredRows > 0 ? `; ${ignoredRows} linha(s) ignorada(s)` : ''}.`,
      });
      fetchRegistrosDados();
    } catch (error) {
      console.error('Erro ao importar registros do departamento pessoal:', error);
      toast({
        title: 'Erro na importacao',
        description: 'Nao foi possivel importar a planilha. Confira o modelo e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsImportingRegistros(false);
    }
  };

  const filteredRegistrosDados = useMemo(() => {
    const searchTerm = registroSearch.trim().toLowerCase();
    if (!searchTerm) return registrosDados;

    return registrosDados.filter(registro =>
      [registro.nome, registro.cpf, registro.setor]
        .some(value => (value || '').toLowerCase().includes(searchTerm)),
    );
  }, [registrosDados, registroSearch]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || (isAdmin && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccessDepartment) {
    return null;
  }

  return (
    <div className="min-h-full p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Configurações
            </h1>
            <p className="text-muted-foreground">
              Gerencie usuarios, aprovacoes e departamento pessoal
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                if (isAdmin) fetchUsers();
                fetchRegistrosDados();
              }}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        <Tabs defaultValue={isAdmin ? 'controle-usuarios' : 'departamento-pessoal'} className="w-full">
          <TabsList>
            {isAdmin && (
              <TabsTrigger value="controle-usuarios">
                Controle de Usuarios
              </TabsTrigger>
            )}
            <TabsTrigger value="departamento-pessoal">
              Departamento Pessoal
            </TabsTrigger>
          </TabsList>

          {isAdmin && (
            <TabsContent value="controle-usuarios" className="flex flex-col gap-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total de Usuários
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{allUsers.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-success" />
                Usuários Aprovados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-success">
                {allUsers.filter((u) => u.approved).length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                Pendentes de Aprovação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-warning">
                {pendingUsers.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="aprovados" className="w-full">
          <TabsList>
            <TabsTrigger value="aprovados">
              Usuários ({allUsers.filter((u) => u.approved).length})
            </TabsTrigger>
            <TabsTrigger value="pendentes" className="gap-2">
              Aprovações Pendentes
              {pendingUsers.length > 0 && (
                <Badge variant="outline" className="text-warning">
                  {pendingUsers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Pending Users */}
          <TabsContent value="pendentes">
            <Card className="border-warning/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <Clock className="h-5 w-5" />
                  Usuários Pendentes ({pendingUsers.length})
                </CardTitle>
                <CardDescription>
                  Usuários aguardando aprovação para acessar o sistema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhum usuário pendente no momento.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsers.map((pendingUser) => (
                        <TableRow key={pendingUser.id}>
                          <TableCell className="font-medium">
                            {pendingUser.email || '-'}
                          </TableCell>
                          <TableCell>{pendingUser.display_name || '-'}</TableCell>
                          <TableCell>{formatDate(pendingUser.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => approveUser(pendingUser.id)}
                              disabled={approvingId === pendingUser.id}
                              className="gap-2"
                            >
                              {approvingId === pendingUser.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              Aprovar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Approved Users */}
          <TabsContent value="aprovados">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuários ({allUsers.filter((u) => u.approved).length})
                </CardTitle>
                <CardDescription>
                  Lista de usuários ativos no sistema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aprovado em</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers
                      .filter((u) => u.approved)
                      .map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">
                            {u.email || '-'}
                            {u.id === user?.id && (
                              <Badge variant="outline" className="ml-2">
                                Você
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{u.display_name || '-'}</TableCell>
                          <TableCell>
                            {u.id === user?.id ? (
                              <Badge variant={getProfileRole(u.role) === 'admin' ? 'default' : 'secondary'}>
                                {getProfileRole(u.role)}
                              </Badge>
                            ) : (
                              <Select
                                value={getProfileRole(u.role)}
                                onValueChange={(value) => changeRole(u.id, value as ProfileRole)}
                                disabled={approvingId === u.id}
                              >
                                <SelectTrigger className="w-[120px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="rh">rh</SelectItem>
                                  <SelectItem value="admin">admin</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-success text-success-foreground gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Aprovado
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {u.approved_at ? formatDate(u.approved_at) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {u.id !== user?.id && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => revokeAccess(u.id)}
                                disabled={approvingId === u.id}
                                className="gap-2"
                              >
                                {approvingId === u.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                                Revogar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
            </TabsContent>
          )}

          <TabsContent value="departamento-pessoal">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      Departamento Pessoal
                    </CardTitle>
                    <CardDescription>
                      Dados dos tecnicos cadastrados em registros_dados.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={downloadRegistrosTemplate}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Baixar modelo
                    </Button>
                    {canEditDepartment && (
                      <>
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={importRegistrosExcel}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isImportingRegistros}
                          className="gap-2"
                        >
                          {isImportingRegistros ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          Importar Excel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={registroSearch}
                      onChange={(event) => setRegistroSearch(event.target.value)}
                      placeholder="Buscar por nome, CPF ou setor"
                      className="pl-9"
                    />
                  </div>
                  <Badge variant="secondary">
                    {filteredRegistrosDados.length} registro(s)
                  </Badge>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Atualizado em</TableHead>
                      {canEditDepartment && <TableHead className="text-right">Acao</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingRegistros ? (
                      <TableRow>
                        <TableCell colSpan={canEditDepartment ? 5 : 4} className="py-8 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Carregando registros...
                        </TableCell>
                      </TableRow>
                    ) : filteredRegistrosDados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canEditDepartment ? 5 : 4} className="py-8 text-center text-muted-foreground">
                          Nenhum registro encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRegistrosDados.map((registro) => (
                        <TableRow key={registro.id}>
                          <TableCell className="min-w-[260px]">
                            <Input
                              value={registro.nome || ''}
                              onChange={(event) => updateRegistroField(registro.id, 'nome', event.target.value)}
                              disabled={!canEditDepartment || savingRegistroId === registro.id}
                            />
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            <Input
                              value={registro.cpf || ''}
                              onChange={(event) => updateRegistroField(registro.id, 'cpf', event.target.value)}
                              disabled={!canEditDepartment || savingRegistroId === registro.id}
                            />
                          </TableCell>
                          <TableCell className="min-w-[220px]">
                            <Input
                              value={registro.setor || ''}
                              onChange={(event) => updateRegistroField(registro.id, 'setor', event.target.value)}
                              disabled={!canEditDepartment || savingRegistroId === registro.id}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {registro.updated_at ? formatDate(registro.updated_at) : '-'}
                          </TableCell>
                          {canEditDepartment && (
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => saveRegistro(registro)}
                                disabled={savingRegistroId === registro.id}
                                className="gap-2"
                              >
                                {savingRegistroId === registro.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                                Salvar
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
