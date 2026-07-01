import React, { useRef, useState } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';

interface Props {
    onImport: (rows: Record<string, any>[]) => Promise<{ inserted: number; skipped: number; errors: string[] }>;
}

const normalizeKey = (k: string) =>
    k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const COLUMN_MAP: Record<string, string> = {
    'DATA PAG': 'data',
    'DATA': 'data',
    'BANCO': 'banco',
    'DESCRICAO': 'descricao',
    'OBSERVACAO': 'descricao',
    'VALOR': 'valor',
    'UNIDADE': 'unidade',
    'CENTRO DE CUSTO': 'centro_de_custo',
    'CENTRO DE CUSTEIO': 'centro_custeio',
    'CATEGORIA': 'categoria',
    'STATUS': 'status_pag',
    'CNPJ': 'cnpj',
    'FORMA PG': 'forma_pagamento',
    'FORMA DE PAGAMENTO': 'forma_pagamento',
};

const excelDateToISO = (val: any): string | null => {
    if (val == null || val === '') return null;
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    if (typeof val === 'number') {
        const d = XLSX.SSF.parse_date_code(val);
        if (!d) return null;
        const mm = String(d.m).padStart(2, '0');
        const dd = String(d.d).padStart(2, '0');
        return `${d.y}-${mm}-${dd}`;
    }
    const s = String(val).trim();
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
    return null;
};

const parseValor = (v: any): number | null => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/[R$\s.]/g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
};

export const ComissionamentoImportExcel: React.FC<Props> = ({ onImport }) => {
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
            const errosValidacao: string[] = [];

            for (let index = 0; index < raw.length; index++) {
                const row = raw[index];
                const linhaExcel = index + 2; // +2 porque a linha 1 é o cabeçalho

                const obj: Record<string, any> = {};
                let hasAny = false;

                for (const [k, v] of Object.entries(row)) {
                    const norm = normalizeKey(k);
                    const field = COLUMN_MAP[norm];
                    if (!field) continue;

                    if (v != null && String(v).trim() !== '') hasAny = true;
                    obj[field] = v;
                }

                // Linha totalmente vazia pode ser ignorada
                if (!hasAny) continue;

                const data = excelDateToISO(obj.data);
                const valor = parseValor(obj.valor);

                const unidade = obj.unidade ? String(obj.unidade).trim() : null;
                const centroDeCusto = obj.centro_de_custo ? String(obj.centro_de_custo).trim() : null;
                const categoria = obj.categoria ? String(obj.categoria).trim() : null;
                const cnpj = obj.cnpj ? String(obj.cnpj).trim() : null;

                const camposFaltando: string[] = [];

                if (!data) camposFaltando.push("DATA");
                if (valor == null) camposFaltando.push("VALOR");
                if (!unidade) camposFaltando.push("UNIDADE");
                if (!centroDeCusto) camposFaltando.push("CENTRO DE CUSTO");
                if (!categoria) camposFaltando.push("CATEGORIA");
                if (!cnpj) camposFaltando.push("CNPJ");

                if (camposFaltando.length > 0) {
                    errosValidacao.push(
                        `Linha ${linhaExcel}: preencher ${camposFaltando.join(", ")}`
                    );
                    continue;
            }

    mapped.push({
        data_lancamento: data,
        valor,
        descricao: obj.descricao ? String(obj.descricao).trim() : null,
        banco: obj.banco ? String(obj.banco).trim() : null,
        unidade_name: unidade,
        centro_de_custo_name: centroDeCusto,
        categoria_name: categoria,
        cnpj_name: cnpj,
        status_pag: obj.status_pag ? String(obj.status_pag).trim() : null,
        forma_pagamento: obj.forma_pagamento ? String(obj.forma_pagamento).trim() : null,
    });
}

if (errosValidacao.length > 0) {
    throw new Error(
        `Importação cancelada. Corrija o Excel antes de importar:\n\n${errosValidacao.join("\n")}`
    );
}

            if (mapped.length === 0) {
                setResult({ ok: false, message: 'Nenhuma linha válida encontrada na planilha.' });
                return;
            }

            const res = await onImport(mapped);
            const msg = `${res.inserted} importados${res.skipped ? `, ${res.skipped} ignorados` : ''}${res.errors.length ? ` — ${res.errors.length} erro(s)` : ''}.`;
            setResult({ ok: res.errors.length === 0, message: msg });
        } catch (err: any) {
            setResult({ ok: false, message: err.message || 'Erro ao importar planilha.' });
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
                title="Importar planilha Excel (somente admin)"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importar Excel
            </Button>
            <Dialog open={!!result} onOpenChange={(open) => !open && setResult(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className={result?.ok ? "text-emerald-500" : "text-destructive"}>
                            {result?.ok ? "Importação concluída" : "Erro na importação"}
                        </DialogTitle>

                        <DialogDescription asChild>
                            <div className="mt-3 max-h-[400px] overflow-y-auto whitespace-pre-line text-sm text-muted-foreground">
                                {result?.message}
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter>
                        <Button onClick={() => setResult(null)}>
                            Entendi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* {result && (
                <span className={`flex items-center gap-1 text-xs ${result.ok ? 'text-emerald-500' : 'text-destructive'}`}>
                    {result.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {result.message}
                </span>
            )} */}
        </>
    );
};
