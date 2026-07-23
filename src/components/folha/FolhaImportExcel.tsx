import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
    onImport: (rows: Record<string, any>[]) => Promise<{ inserted: number; skipped: number; errors: string[] }>;
}

const todayInput = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normKey = (key: string) =>
    String(key || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[°º]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

const COLUMN_MAP: Record<string, string> = {
    NOME: 'nome',
    CPF: 'cpf',
    'HORAS NORMAIS': 'sal_folha',
    'SAL. FOLHA': 'sal_folha',
    'SAL FOLHA': 'sal_folha',
    'SALARIO FOLHA': 'sal_folha',
    'PRO-LABORE': 'pro_labore',
    'PRO LABORE': 'pro_labore',
    QUINQUENIO: 'quinquenio',
    'DISTRIBUICAO DE LUCROS': 'distribuicao_lucros',
    'REFLEXO EXTRAS DSR': 'reflexo_extras_dsr',
    'REFLEXO HORAS EXTRAS DSR': 'reflexo_extras_dsr',
    'ESTOURO DO MES': 'estouro_mes',
    'DIFERENCA DE 1/3 DE FERIAS': 'diferenca_um_terco_ferias',
    'DIFERENCA MEDIA HORA FERIAS': 'diferenca_media_hora_ferias',
    'HORAS AFAST. P/DOENCA C/DIR.INTEGRAIS': 'horas_afast_doenca_integral',
    'HORAS AFAST P/DOENCA C/DIR INTEGRAIS': 'horas_afast_doenca_integral',
    'MEDIA AFAST DOENCA DIR. INTEGRAL': 'media_afast_doenca_integral',
    'MEDIA AFAST DOENCA DIR INTEGRAL': 'media_afast_doenca_integral',
    'PERICULOSIDADE IGUAL OU INFE. 15/30 DIAS': 'periculosidade_proporcional',
    'PERICULOSIDADE IGUAL OU INFE 15/30 DIAS': 'periculosidade_proporcional',
    'INSS DIFERENCA FERIAS': 'inss_diferenca_ferias',
    'INSS EMPREGADOR': 'inss_empregador',
    'IRRF EMPREGADOR': 'irrf_empregador',
    'I.N.S.S.': 'inss',
    'I.N.S.S': 'inss',
    'INSS': 'inss',
    'SAL FAMILIA': 'sal_familia',
    'SAL. FAMILIA': 'sal_familia',
    'SALARIO FAMILIA': 'sal_familia',
    'DESC INSS': 'desc_inss',
    'DESC. INSS': 'desc_inss',
    IRRF: 'irrf',
    FERIAS: 'ferias',
    '13 SALARIO': 'decimo_terceiro',
    '13O SALARIO': 'decimo_terceiro',
    '13 SAL': 'decimo_terceiro',
    PERICULOSIDADE: 'periculosidade',
    'HORA EXTRA 50%': 'hora_extra_50',
    'HORAS EXTRAS 50%': 'hora_extra_50',
    'HORA EXTRA 60%': 'hora_extra_60',
    'HORAS EXTRAS 60%': 'hora_extra_60',
    'HORA EXTRA 70%': 'hora_extra_70',
    'HORAS EXTRAS 70%': 'hora_extra_70',
    'HORA EXTRA 100%': 'hora_extra_100',
    'HORAS EXTRAS 100%': 'hora_extra_100',
    DSR: 'dsr',
    'SAL MATERNIDADE': 'sal_maternidade',
    'SAL. MATERNIDADE': 'sal_maternidade',
    'SALARIO MATERNIDADE': 'sal_maternidade',
    'VALE TRANSPORTE': 'vale_transporte',
    VT: 'vale_transporte',
    'DESC PLANO SAUDE': 'desc_plano_saude',
    'DESC. PLANO SAUDE': 'desc_plano_saude',
    'DESC VALE ALIMENTACAO': 'desc_vale_alimentacao',
    'DESC. VALE ALIMENTACAO': 'desc_vale_alimentacao',
    'DESC ALIMENTACAO': 'desc_vale_alimentacao',
    'VALE ALIMENTACAO': 'desc_vale_alimentacao',
    'DESC ODONTO': 'desc_odonto',
    'DESC. ODONTO': 'desc_odonto',
    'DESC FALTAS': 'desc_faltas',
    'DESC. FALTAS': 'desc_faltas',
    'DESC ADIANTAMENTO': 'desc_adiantamento',
    'DESC. ADIANTAMENTO': 'desc_adiantamento',
    CONTRIBUICAO: 'contribuicao',
    'DESC PENSAO': 'desc_pensao',
    'DESC. PENSAO': 'desc_pensao',
    'DIF. SALARIO': 'dif_salario',
    'DIF SALARIO': 'dif_salario',
    EMPRESTIMO: 'emprestimo',
    'DESC EMPRESTIMO': 'emprestimo',
    'DESC FARDAMENTO': 'desc_fardamento',
    'DESC. FARDAMENTO': 'desc_fardamento',
    FARDAMENTO: 'desc_fardamento',
    'DEMAIS DESC': 'demais_desc',
    'DEMAIS DESCONTOS': 'demais_desc',
    'OUTROS DESCONTOS': 'demais_desc',
    'T. PROVENTOS': 'total_proventos',
    'T PROVENTOS': 'total_proventos',
    'TOTAL PROVENTOS': 'total_proventos',
    'T. DESCONTOS': 'total_descontos',
    'T DESCONTOS': 'total_descontos',
    'TOTAL DESCONTOS': 'total_descontos',
    'SALARIO LIQUIDO': 'salario_liquido',
    'SAL LIQUIDO': 'salario_liquido',
    'SAL. LIQUIDO': 'salario_liquido',
    LIQUIDO: 'salario_liquido',
    LIQUIDOS: 'salario_liquido',
};

const NUMERIC_FIELDS = new Set([
    'sal_folha', 'sal_familia', 'desc_inss', 'inss', 'irrf', 'ferias', 'decimo_terceiro',
    'periculosidade', 'hora_extra_50', 'hora_extra_60', 'hora_extra_70', 'hora_extra_100', 'dsr',
    'sal_maternidade', 'vale_transporte', 'desc_plano_saude', 'desc_vale_alimentacao', 'desc_odonto',
    'desc_faltas', 'desc_adiantamento', 'contribuicao', 'desc_pensao', 'dif_salario', 'emprestimo',
    'desc_fardamento', 'demais_desc', 'pro_labore', 'quinquenio', 'distribuicao_lucros',
    'reflexo_extras_dsr', 'estouro_mes', 'diferenca_um_terco_ferias', 'diferenca_media_hora_ferias',
    'horas_afast_doenca_integral', 'media_afast_doenca_integral', 'periculosidade_proporcional',
    'inss_diferenca_ferias', 'inss_empregador', 'irrf_empregador',
    'total_proventos', 'total_descontos', 'salario_liquido',
]);

const parseNum = (value: any): number => {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return value;
    const normalized = String(value).replace(/[R$\s.]/g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeCpf = (value: any) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.length < 11 ? digits.padStart(11, '0') : digits;
};

const readPayrollRows = async (file: File, dataFolha: string) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: null, raw: true });
        const headers = new Set(raw.flatMap(row => Object.keys(row).map(normKey)));
        if (!headers.has('NOME') || !headers.has('CPF')) continue;

        return raw.flatMap(row => {
            const mapped: Record<string, any> = {};
            for (const [key, value] of Object.entries(row)) {
                const field = COLUMN_MAP[normKey(key)];
                if (field) mapped[field] = value;
            }

            const nome = mapped.nome ? String(mapped.nome).trim() : '';
            const cpf = normalizeCpf(mapped.cpf);
            if (!nome && !cpf) return [];

            const record: Record<string, any> = { data: dataFolha, nome, cpf };
            for (const field of NUMERIC_FIELDS) record[field] = parseNum(mapped[field]);
            return [record];
        });
    }

    throw new Error('Nao foi encontrada uma aba com as colunas nome e cpf.');
};

export const FolhaImportExcel: React.FC<Props> = ({ onImport }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [dataFolha, setDataFolha] = useState(todayInput());
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    const handleOpenChange = (nextOpen: boolean) => {
        if (loading) return;
        setOpen(nextOpen);
        if (nextOpen) {
            setFile(null);
            setDataFolha(todayInput());
            setResult(null);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const handleSubmit = async () => {
        if (!file || !dataFolha) {
            setResult({ ok: false, message: 'Selecione a data da folha e o arquivo Excel.' });
            return;
        }

        setLoading(true);
        setResult(null);
        try {
            const rows = await readPayrollRows(file, dataFolha);
            if (rows.length === 0) throw new Error('Nenhuma linha valida encontrada no arquivo.');

            const response = await onImport(rows);
            const message = `${response.inserted} sincronizado(s), ${response.skipped} ignorado(s).${response.errors.length ? ` ${response.errors[0]}` : ''}`;
            const ok = response.errors.length === 0;
            setResult({ ok, message });
        } catch (error: any) {
            setResult({ ok: false, message: error.message || 'Erro ao importar a folha.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(true)}
                className="gap-1 border-primary/40 text-primary hover:bg-primary/10"
            >
                <Upload className="w-4 h-4" />
                Importar Excel
            </Button>

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Importar Folha de Pagamento</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <Label htmlFor="folha-data">Data da folha *</Label>
                            <Input
                                id="folha-data"
                                type="date"
                                value={dataFolha}
                                onChange={event => setDataFolha(event.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Esta data sera aplicada a todos os colaboradores do arquivo.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="folha-arquivo">Arquivo Excel *</Label>
                            <Input
                                ref={inputRef}
                                id="folha-arquivo"
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={event => setFile(event.target.files?.[0] || null)}
                            />
                            {file && (
                                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                                    <span className="truncate">{file.name}</span>
                                </div>
                            )}
                        </div>

                        {result && (
                            <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${result.ok ? 'border-emerald-500/40 text-emerald-500' : 'border-destructive/40 text-destructive'}`}>
                                {result.ok ? <CheckCircle className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
                                <span>{result.message}</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>Fechar</Button>
                        <Button onClick={handleSubmit} disabled={loading || !file || !dataFolha} className="gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Importar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
