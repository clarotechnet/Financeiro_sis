import React, { useRef, useState } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

interface Props {
    onImport: (rows: Record<string, any>[]) => Promise<{ inserted: number; skipped: number; errors: string[] }>;
}

const normKey = (k: string) =>
    k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[°º]/g, '').replace(/\s+/g, ' ').trim();

const COLUMN_MAP: Record<string, string> = {
    'DATA': 'data',
    'NOME': 'nome',
    'CPF': 'cpf',
    'SAL. FOLHA': 'sal_folha',
    'SAL FOLHA': 'sal_folha',
    'SALARIO FOLHA': 'sal_folha',
    'SAL FAMILIA': 'sal_familia',
    'SAL. FAMILIA': 'sal_familia',
    'SALARIO FAMILIA': 'sal_familia',
    'DESC INSS': 'desc_inss',
    'DESC. INSS': 'desc_inss',
    'IRRF': 'irrf',
    'FERIAS': 'ferias',
    '13 SALARIO': 'decimo_terceiro',
    '13° SALARIO': 'decimo_terceiro',
    '13o SALARIO': 'decimo_terceiro',
    '13 SAL': 'decimo_terceiro',
    'PERICULOSIDADE': 'periculosidade',
    'HORA EXTRA 50%': 'hora_extra_50',
    'HORA EXTRA 50': 'hora_extra_50',
    'HORA EXTRA 60%': 'hora_extra_60',
    'HORA EXTRA 60': 'hora_extra_60',
    'HORA EXTRA 70%': 'hora_extra_70',
    'HORA EXTRA 70': 'hora_extra_70',
    'HORA EXTRA 100%': 'hora_extra_100',
    'HORA EXTRA 100': 'hora_extra_100',
    'DSR': 'dsr',
    'SAL MATERNIDADE': 'sal_maternidade',
    'SAL. MATERNIDADE': 'sal_maternidade',
    'SALARIO MATERNIDADE': 'sal_maternidade',
    'VALE TRANSPORTE': 'vale_transporte',
    'VT': 'vale_transporte',
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
    'CONTRIBUICAO': 'contribuicao',
    'DESC PENSAO': 'desc_pensao',
    'DESC. PENSAO': 'desc_pensao',
    'DIF. SALARIO': 'dif_salario',
    'DIF SALARIO': 'dif_salario',
    'EMPRESTIMO': 'emprestimo',
    'EMPRÉSTIMO': 'emprestimo',
    'DESC EMPRESTIMO': 'emprestimo',
    'DESC FARDAMENTO': 'desc_fardamento',
    'DESC. FARDAMENTO': 'desc_fardamento',
    'FARDAMENTO': 'desc_fardamento',
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
};

const NUMERIC_FIELDS = new Set([
    'sal_folha', 'sal_familia', 'desc_inss', 'irrf', 'ferias', 'decimo_terceiro', 'periculosidade',
    'hora_extra_50', 'hora_extra_60', 'hora_extra_70', 'hora_extra_100', 'dsr',
    'sal_maternidade', 'vale_transporte',
    'desc_plano_saude', 'desc_vale_alimentacao', 'desc_odonto', 'desc_faltas', 'desc_adiantamento',
    'contribuicao', 'desc_pensao', 'dif_salario', 'emprestimo', 'desc_fardamento', 'demais_desc',
    'total_proventos', 'total_descontos', 'salario_liquido',
]);

const excelDateToISO = (v: any): string | null => {
    if (v == null || v === '') return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'number') {
        const d = XLSX.SSF.parse_date_code(v);
        if (!d) return null;
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    const s = String(v).trim();
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
    return null;
};

const parseNum = (v: any): number => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/[R$\s.]/g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
};

const onlyDigits = (v: any) => String(v ?? '').replace(/\D/g, '');

export const FolhaImportExcel: React.FC<Props> = ({ onImport }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    const handleFile = async (file: File) => {
        setLoading(true);
        setResult(null);
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: 'array', cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

            const mapped: Record<string, any>[] = [];
            for (const row of raw) {
                const obj: Record<string, any> = {};
                let hasAny = false;
                for (const [k, v] of Object.entries(row)) {
                    const field = COLUMN_MAP[normKey(k)];
                    if (!field) continue;
                    if (v != null && String(v).trim() !== '') hasAny = true;
                    obj[field] = v;
                }
                if (!hasAny) continue;

                const rec: Record<string, any> = {
                    data: excelDateToISO(obj.data),
                    nome: obj.nome ? String(obj.nome).trim() : null,
                    cpf: onlyDigits(obj.cpf),
                };
                for (const f of NUMERIC_FIELDS) rec[f] = parseNum(obj[f]);
                mapped.push(rec);
            }

            if (mapped.length === 0) {
                setResult({ ok: false, message: 'Nenhuma linha válida encontrada.' });
                return;
            }
            const res = await onImport(mapped);
            const msg = `${res.inserted} importados${res.skipped ? `, ${res.skipped} ignorados` : ''}${res.errors.length ? ` — ${res.errors.length} erro(s)` : ''}.`;
            setResult({ ok: res.errors.length === 0, message: msg });
        } catch (e: any) {
            setResult({ ok: false, message: e.message || 'Erro ao importar.' });
        } finally {
            setLoading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
                className="gap-1 border-primary/40 text-primary hover:bg-primary/10"
                title="Importar planilha Excel"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importar Excel
            </Button>
            {result && (
                <span className={`flex items-center gap-1 text-xs ${result.ok ? 'text-emerald-500' : 'text-destructive'}`}>
                    {result.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {result.message}
                </span>
            )}
        </>
    );
};
