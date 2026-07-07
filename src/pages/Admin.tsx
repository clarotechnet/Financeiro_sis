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
  getProfileRole,
  getProfileRoleLabel,
  PROFILE_ROLE_OPTIONS,
  ProfileRole,
  ROLE_ADMIN,
  ROLE_FINANCE_ASSISTANT,
  ROLE_RH,
} from '@/lib/profileRoles';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
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
  setor_codigo: string | null;
  unidade_codigo: string | null;
  subgrupo_plano_conta_id: string | null;
  created_at: string;
  updated_at: string | null;
}

interface UnidadeOpcao {
  codigo: string;
  unidade: string;
}

interface SetorOpcao {
  codigo: string;
  setor: string;
}

interface SubgrupoOpcao {
  id: string;
  codigo: string;
  descricao: string;
  natureza: string | null;
}

type ExcelRow = Record<string, unknown>;

const REGISTROS_TEMPLATE_HEADERS = ['nome', 'cpf', 'setor_codigo', 'unidade_codigo', 'subgrupo_codigo'];
const REGISTROS_PAGE_SIZE = 50;

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
  const [opcoesUnidades, setOpcoesUnidades] = useState<UnidadeOpcao[]>([]);
  const [opcoesSetores, setOpcoesSetores] = useState<SetorOpcao[]>([]);
  const [opcoesSubgrupos, setOpcoesSubgrupos] = useState<SubgrupoOpcao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRegistros, setIsLoadingRegistros] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [savingRegistroId, setSavingRegistroId] = useState<string | null>(null);
  const [isImportingRegistros, setIsImportingRegistros] = useState(false);
  const [registroSearch, setRegistroSearch] = useState('');
  const [registroPage, setRegistroPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRh = profile?.role === ROLE_RH;
  const isFinanceAssistant = profile?.role === ROLE_FINANCE_ASSISTANT;
  const canViewUsers = isAdmin || isFinanceAssistant;
  const canManageUsers = isAdmin;
  const canAccessDepartment = isAdmin || isRh || isFinanceAssistant;
  const canAccessSettingsPage = canAccessDepartment || canViewUsers;
  const canEditDepartment = isAdmin || isRh;

  const fetchUnidades = useCallback(async () => {
    if (!canAccessDepartment) {
      setOpcoesUnidades([]);
      return;
    }

    const { data, error } = await externalSupabase
      .from('unidades')
      .select('codigo, unidade')
      .eq('ativo', true);

    if (error) {
      console.error('Erro ao buscar unidades:', error);
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar as unidades.',
        variant: 'destructive',
      });
      return;
    }

    setOpcoesUnidades(((data || []) as UnidadeOpcao[]).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })
    ));
  }, [canAccessDepartment]);

  const fetchSetores = useCallback(async () => {
    if (!canAccessDepartment) {
      setOpcoesSetores([]);
      return;
    }

    const { data, error } = await externalSupabase
      .from('setor')
      .select('codigo, setor')
      .eq('ativo', true);

    if (error) {
      console.error('Erro ao buscar setores:', error);
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar os setores.',
        variant: 'destructive',
      });
      return;
    }

    setOpcoesSetores(((data || []) as SetorOpcao[]).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })
    ));
  }, [canAccessDepartment]);

  const fetchSubgruposPlanoContas = useCallback(async () => {
    if (!canAccessDepartment) {
      setOpcoesSubgrupos([]);
      return;
    }

    const { data, error } = await externalSupabase
      .from('plano_contas')
      .select('id, codigo, descricao, natureza')
      .eq('nivel', 2)
      .eq('e_analitica', false)
      .eq('ativo', true)
      .order('codigo', { ascending: true });

    if (error) {
      console.error('Erro ao buscar subgrupos do plano de contas:', error);
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar os subgrupos do plano de contas.',
        variant: 'destructive',
      });
      return;
    }

    setOpcoesSubgrupos((data || []) as SubgrupoOpcao[]);
  }, [canAccessDepartment]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Buscar usuários pendentes
      if (canManageUsers) {
        const { data: pending, error: pendingError } = await externalSupabase
          .from('pending_users')
          .select('*')
          .order('created_at', { ascending: true });

        if (pendingError) throw pendingError;
        setPendingUsers(pending || []);
      } else {
        setPendingUsers([]);
      }

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
  }, [canManageUsers]);

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
        .select('id,nome,cpf,setor,setor_codigo,unidade_codigo,subgrupo_plano_conta_id,created_at,updated_at')
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

    if (!canAccessSettingsPage) {
      navigate('/');
      return;
    }

    if (canViewUsers) {
      fetchUsers();
    } else {
      setPendingUsers([]);
      setAllUsers([]);
      setIsLoading(false);
    }

    fetchRegistrosDados();
    fetchUnidades();
    fetchSetores();
    fetchSubgruposPlanoContas();
  }, [authLoading, canAccessDepartment, canAccessSettingsPage, canViewUsers, navigate, fetchUsers, fetchRegistrosDados, fetchUnidades, fetchSetores, fetchSubgruposPlanoContas]);

  useEffect(() => {
    if (opcoesSetores.length === 0) return;

    setRegistrosDados(prev =>
      prev.map(registro => {
        if (registro.setor_codigo || !registro.setor) return registro;

        const setorCorrespondente = opcoesSetores.find(opcao =>
          opcao.setor.trim().toLowerCase() === registro.setor?.trim().toLowerCase()
        );

        return setorCorrespondente
          ? { ...registro, setor_codigo: setorCorrespondente.codigo }
          : registro;
      }),
    );
  }, [opcoesSetores]);

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
        description: `Usuário agora é ${getProfileRoleLabel(newRole)}.`,
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
    field: 'nome' | 'cpf' | 'setor_codigo' | 'unidade_codigo' | 'subgrupo_plano_conta_id',
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
    const setor_codigo = (registro.setor_codigo || '').trim();
    const setor = opcoesSetores.find(opcao => opcao.codigo === setor_codigo)?.setor || (registro.setor || '').trim();
    const unidade_codigo = (registro.unidade_codigo || '').trim();
    const subgrupo_plano_conta_id = (registro.subgrupo_plano_conta_id || '').trim();

    if (!nome || !cpf || !setor_codigo || !unidade_codigo || !subgrupo_plano_conta_id) {
      toast({
        title: 'Campos obrigatorios',
        description: 'Preencha nome, CPF, setor, unidade e subgrupo DRE antes de salvar.',
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
          setor_codigo,
          unidade_codigo,
          subgrupo_plano_conta_id,
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
    worksheet['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 32 }, { wch: 18 }, { wch: 20 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'registros_dados');
    const setoresWorksheet = XLSX.utils.json_to_sheet(
      opcoesSetores.map(setor => ({
        setor_codigo: setor.codigo,
        setor: setor.setor,
      })),
    );
    setoresWorksheet['!cols'] = [{ wch: 18 }, { wch: 46 }];
    XLSX.utils.book_append_sheet(workbook, setoresWorksheet, 'setores');
    const unidadesWorksheet = XLSX.utils.json_to_sheet(
      opcoesUnidades.map(unidade => ({
        unidade_codigo: unidade.codigo,
        unidade: unidade.unidade,
      })),
    );
    unidadesWorksheet['!cols'] = [{ wch: 18 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(workbook, unidadesWorksheet, 'unidades');
    const subgruposWorksheet = XLSX.utils.json_to_sheet(
      opcoesSubgrupos.map(subgrupo => ({
        subgrupo_codigo: subgrupo.codigo,
        subgrupo: subgrupo.descricao,
        natureza: subgrupo.natureza || '',
      })),
    );
    subgruposWorksheet['!cols'] = [{ wch: 20 }, { wch: 46 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, subgruposWorksheet, 'subgrupos_dre');
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
        .map(row => {
          const setorCodigo = getExcelValue(row, 'setorcodigo') || getExcelValue(row, 'codigosetor');
          const setorNome = getExcelValue(row, 'setor');
          const setorPorCodigo = opcoesSetores.find(opcao =>
            opcao.codigo.trim().toLowerCase() === setorCodigo.trim().toLowerCase()
          );
          const setorPorNome = opcoesSetores.find(opcao =>
            opcao.setor.trim().toLowerCase() === setorNome.trim().toLowerCase()
          );
          const unidadeCodigo = getExcelValue(row, 'unidadecodigo') || getExcelValue(row, 'codigounidade');
          const unidadeNome = getExcelValue(row, 'unidade');
          const unidadePorNome = opcoesUnidades.find(opcao =>
            opcao.unidade.trim().toLowerCase() === unidadeNome.trim().toLowerCase()
          );
          const subgrupoCodigo = getExcelValue(row, 'subgrupocodigo') || getExcelValue(row, 'codigosubgrupo');
          const subgrupoDescricao = getExcelValue(row, 'subgrupo');
          const subgrupoPorCodigo = opcoesSubgrupos.find(opcao =>
            opcao.codigo.trim().toLowerCase() === subgrupoCodigo.trim().toLowerCase()
          );
          const subgrupoPorDescricao = opcoesSubgrupos.find(opcao =>
            opcao.descricao.trim().toLowerCase() === subgrupoDescricao.trim().toLowerCase()
          );

          return {
            nome: getExcelValue(row, 'nome'),
            cpf: getExcelValue(row, 'cpf').replace(/\D/g, ''),
            setor: setorPorCodigo?.setor || setorPorNome?.setor || setorNome,
            setor_codigo: setorPorCodigo?.codigo || setorPorNome?.codigo || '',
            unidade_codigo: unidadeCodigo || unidadePorNome?.codigo || '',
            subgrupo_plano_conta_id: subgrupoPorCodigo?.id || subgrupoPorDescricao?.id || '',
          };
        })
        .filter(row => row.nome && row.cpf && row.setor_codigo && row.unidade_codigo && row.subgrupo_plano_conta_id);

      if (registros.length === 0) {
        toast({
          title: 'Planilha sem dados validos',
          description: 'Use as colunas nome, cpf, setor_codigo, unidade_codigo e subgrupo_codigo no arquivo de importacao.',
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

  const unidadeNomeByCodigo = useMemo(() => {
    return new Map(opcoesUnidades.map(unidade => [unidade.codigo, unidade.unidade]));
  }, [opcoesUnidades]);

  const setorNomeByCodigo = useMemo(() => {
    return new Map(opcoesSetores.map(setor => [setor.codigo, setor.setor]));
  }, [opcoesSetores]);

  const subgrupoById = useMemo(() => {
    return new Map(opcoesSubgrupos.map(subgrupo => [subgrupo.id, subgrupo]));
  }, [opcoesSubgrupos]);

  const filteredRegistrosDados = useMemo(() => {
    const searchTerm = registroSearch.trim().toLowerCase();
    if (!searchTerm) return registrosDados;

    return registrosDados.filter(registro =>
      [
        registro.nome,
        registro.cpf,
        registro.setor,
        registro.setor_codigo,
        registro.setor_codigo ? setorNomeByCodigo.get(registro.setor_codigo) : '',
        registro.unidade_codigo,
        registro.unidade_codigo ? unidadeNomeByCodigo.get(registro.unidade_codigo) : '',
        registro.subgrupo_plano_conta_id ? subgrupoById.get(registro.subgrupo_plano_conta_id)?.codigo : '',
        registro.subgrupo_plano_conta_id ? subgrupoById.get(registro.subgrupo_plano_conta_id)?.descricao : '',
      ]
        .some(value => (value || '').toLowerCase().includes(searchTerm)),
    );
  }, [registrosDados, registroSearch, setorNomeByCodigo, subgrupoById, unidadeNomeByCodigo]);

  const totalRegistroPages = Math.max(1, Math.ceil(filteredRegistrosDados.length / REGISTROS_PAGE_SIZE));
  const paginatedRegistrosDados = useMemo(() => {
    const start = registroPage * REGISTROS_PAGE_SIZE;
    return filteredRegistrosDados.slice(start, start + REGISTROS_PAGE_SIZE);
  }, [filteredRegistrosDados, registroPage]);
  const registroStart = filteredRegistrosDados.length === 0 ? 0 : registroPage * REGISTROS_PAGE_SIZE + 1;
  const registroEnd = Math.min((registroPage + 1) * REGISTROS_PAGE_SIZE, filteredRegistrosDados.length);

  useEffect(() => {
    setRegistroPage(0);
  }, [registroSearch]);

  useEffect(() => {
    setRegistroPage(currentPage => Math.min(currentPage, totalRegistroPages - 1));
  }, [totalRegistroPages]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || (canViewUsers && isLoading)) {
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
    <div className="min-h-full p-4 md:p-6">
      <div className="w-full max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Configurações
            </h1>
            <p className="text-muted-foreground">
              Gerencie usuarios, aprovacoes e o departamento pessoal
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                if (canViewUsers) fetchUsers();
                if (canAccessDepartment) {
                  fetchRegistrosDados();
                  fetchUnidades();
                  fetchSubgruposPlanoContas();
                }
              }}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        <Tabs defaultValue={canViewUsers ? 'controle-usuarios' : 'departamento-pessoal'} className="w-full">
          <TabsList>
            {canViewUsers && (
              <TabsTrigger value="controle-usuarios">
                Controle de Usuarios
              </TabsTrigger>
            )}
            {canAccessDepartment && (
              <TabsTrigger value="departamento-pessoal">
                Departamento Pessoal
              </TabsTrigger>
            )}
          </TabsList>

          {canViewUsers && (
            <TabsContent value="controle-usuarios" className="flex flex-col gap-6">
              {/* Stats Cards */}
              <div className={`grid grid-cols-1 ${canManageUsers ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
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

                {canManageUsers && (
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
                )}
              </div>

              <Tabs defaultValue="aprovados" className="w-full">
                <TabsList>
                  <TabsTrigger value="aprovados">
                    Usuários ({allUsers.filter((u) => u.approved).length})
                  </TabsTrigger>
                  {canManageUsers && (
                  <TabsTrigger value="pendentes" className="gap-2">
                    Aprovações Pendentes
                    {pendingUsers.length > 0 && (
                      <Badge variant="outline" className="text-warning">
                        {pendingUsers.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  )}
                </TabsList>

                {/* Pending Users */}
                {canManageUsers && (
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
                )}

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
                            {canManageUsers && <TableHead className="text-right">Ação</TableHead>}
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
                                  {u.id === user?.id || !canManageUsers ? (
                                    <Badge variant={getProfileRole(u.role) === ROLE_ADMIN ? 'default' : 'secondary'}>
                                      {getProfileRoleLabel(u.role)}
                                    </Badge>
                                  ) : (
                                    <Select
                                      value={getProfileRole(u.role)}
                                      onValueChange={(value) => changeRole(u.id, value as ProfileRole)}
                                      disabled={approvingId === u.id}
                                    >
                                      <SelectTrigger className="w-[210px] h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {PROFILE_ROLE_OPTIONS.map(option => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
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
                                {canManageUsers && (
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
                                )}
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
            <Card className="overflow-hidden">
              <CardHeader className="px-4 pt-4 pb-3">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      Departamento Pessoal
                    </CardTitle>
                    <CardDescription>
                      Dados dos colaboradores cadastrados no Banco de Dados
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
              <CardContent className="flex flex-col gap-3 px-4 pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={registroSearch}
                      onChange={(event) => setRegistroSearch(event.target.value)}
                      placeholder="Buscar por nome, CPF, setor, unidade ou subgrupo"
                      className="h-9 pl-9 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {filteredRegistrosDados.length} registro(s)
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {filteredRegistrosDados.length > 0
                        ? `${registroStart}-${registroEnd} de ${filteredRegistrosDados.length}`
                        : '0 de 0'}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={registroPage === 0}
                        onClick={() => setRegistroPage(page => Math.max(0, page - 1))}
                        className="h-8 w-8 p-0"
                        title="Pagina anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[74px] text-center text-xs text-muted-foreground">
                        {registroPage + 1} / {totalRegistroPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={registroPage >= totalRegistroPages - 1}
                        onClick={() => setRegistroPage(page => Math.min(totalRegistroPages - 1, page + 1))}
                        className="h-8 w-8 p-0"
                        title="Proxima pagina"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="w-full overflow-auto rounded-md border border-border max-h-[calc(100vh-330px)]">
                  <Table className="min-w-[1180px] text-xs">
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="h-8 px-2 text-xs">Nome</TableHead>
                        <TableHead className="h-8 px-2 text-xs">CPF</TableHead>
                        <TableHead className="h-8 px-2 text-xs">Setor</TableHead>
                        <TableHead className="h-8 px-2 text-xs">Unidade</TableHead>
                        <TableHead className="h-8 px-2 text-xs">Subgrupo DRE</TableHead>
                        <TableHead className="h-8 px-2 text-xs">Atualizado em</TableHead>
                        {canEditDepartment && <TableHead className="h-8 px-2 text-right text-xs">Acao</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingRegistros ? (
                        <TableRow>
                          <TableCell colSpan={canEditDepartment ? 7 : 6} className="py-8 text-center text-muted-foreground">
                            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                            Carregando registros...
                          </TableCell>
                        </TableRow>
                      ) : filteredRegistrosDados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={canEditDepartment ? 7 : 6} className="py-8 text-center text-muted-foreground">
                            Nenhum registro encontrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedRegistrosDados.map((registro) => (
                          <TableRow key={registro.id}>
                            <TableCell className="min-w-[220px] px-2 py-1.5">
                              <Input
                                value={registro.nome || ''}
                                onChange={(event) => updateRegistroField(registro.id, 'nome', event.target.value)}
                                disabled={!canEditDepartment || savingRegistroId === registro.id}
                                className="h-8 px-2 text-xs"
                              />
                            </TableCell>
                            <TableCell className="min-w-[120px] px-2 py-1.5">
                              <Input
                                value={registro.cpf || ''}
                                onChange={(event) => updateRegistroField(registro.id, 'cpf', event.target.value)}
                                disabled={!canEditDepartment || savingRegistroId === registro.id}
                                className="h-8 px-2 text-xs"
                              />
                            </TableCell>
                            <TableCell className="min-w-[210px] px-2 py-1.5">
                              <select
                                value={registro.setor_codigo || ''}
                                onChange={(event) => updateRegistroField(registro.id, 'setor_codigo', event.target.value)}
                                disabled={!canEditDepartment || savingRegistroId === registro.id}
                                className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="">Selecione...</option>
                                {opcoesSetores.map(setor => (
                                  <option key={setor.codigo} value={setor.codigo}>
                                    {setor.setor}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell className="min-w-[210px] px-2 py-1.5">
                              <select
                                value={registro.unidade_codigo || ''}
                                onChange={(event) => updateRegistroField(registro.id, 'unidade_codigo', event.target.value)}
                                disabled={!canEditDepartment || savingRegistroId === registro.id}
                                className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="">Selecione...</option>
                                {opcoesUnidades.map(unidade => (
                                  <option key={unidade.codigo} value={unidade.codigo}>
                                    {unidade.codigo} - {unidade.unidade}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell className="min-w-[250px] px-2 py-1.5">
                              <select
                                value={registro.subgrupo_plano_conta_id || ''}
                                onChange={(event) => updateRegistroField(registro.id, 'subgrupo_plano_conta_id', event.target.value)}
                                disabled={!canEditDepartment || savingRegistroId === registro.id}
                                className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="">Selecione...</option>
                                {opcoesSubgrupos.map(subgrupo => (
                                  <option key={subgrupo.id} value={subgrupo.id}>
                                    {subgrupo.codigo} - {subgrupo.descricao}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell className="whitespace-nowrap px-2 py-1.5 text-xs">
                              {registro.updated_at ? formatDate(registro.updated_at) : '-'}
                            </TableCell>
                            {canEditDepartment && (
                              <TableCell className="px-2 py-1.5 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => saveRegistro(registro)}
                                  disabled={savingRegistroId === registro.id}
                                  className="h-8 gap-1 px-2 text-xs"
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
                </div>
                {filteredRegistrosDados.length > REGISTROS_PAGE_SIZE && (
                  <div className="flex items-center justify-end gap-2 pt-1 text-xs text-muted-foreground">
                    <span>
                      Pagina {registroPage + 1} de {totalRegistroPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={registroPage === 0}
                      onClick={() => setRegistroPage(page => Math.max(0, page - 1))}
                      className="h-8"
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={registroPage >= totalRegistroPages - 1}
                      onClick={() => setRegistroPage(page => Math.min(totalRegistroPages - 1, page + 1))}
                      className="h-8"
                    >
                      Proxima
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
