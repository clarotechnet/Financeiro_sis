import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from './SearchableSelect';
import type { OperationalReportImportResult, OperationalReportImportRow, OpcaoSelect } from '@/types/comissionamento';

interface Props {
  contas: OpcaoSelect[];
  onImport: (
    rows: OperationalReportImportRow[],
    planoContaId: string,
    fileName: string,
  ) => Promise<OperationalReportImportResult>;
}

const normalizeKey = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/\s+/g, ' ')
  .trim();

const getValue = (row: Record<string, unknown>, key: string) => {
  const entry = Object.entries(row).find(([column]) => normalizeKey(column) === key);
  return entry?.[1];
};

const parseDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}` : '';
  }

  const text = String(value || '').trim();
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : '';
};

const parseNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  const normalized = String(value || '').replace(/[R$\s.]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseReport = async (file: File): Promise<OperationalReportImportRow[]> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null, raw: true });

  return rawRows.map((row, index) => ({
    report_id: String(getValue(row, 'RELATORIO ID') || '').trim(),
    row_number: Number(getValue(row, 'LINHA')) || index + 1,
    source: String(getValue(row, 'ORIGEM') || '').trim(),
    source_label: String(getValue(row, 'ORIGEM DESCRICAO') || getValue(row, 'ORIGEM') || 'Relatorio').trim(),
    data_lancamento: parseDate(getValue(row, 'DATA')),
    unidade_codigo: String(getValue(row, 'UNIDADE CODIGO') || '').trim(),
    unidade_nome: String(getValue(row, 'UNIDADE') || '').trim(),
    setor_codigo: String(getValue(row, 'CENTRO DE CUSTO CODIGO') || '').trim(),
    setor_nome: String(getValue(row, 'CENTRO DE CUSTO') || '').trim(),
    descricao: String(getValue(row, 'DESCRICAO') || '').trim(),
    quantidade: Number(getValue(row, 'QUANTIDADE')) || 0,
    valor: parseNumber(getValue(row, 'VALOR')),
  })).filter(row => row.report_id || row.data_lancamento || row.valor > 0);
};

export const ComissionamentoImportReports: React.FC<Props> = ({ contas, onImport }) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<OperationalReportImportRow[]>([]);
  const [planoContaId, setPlanoContaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OperationalReportImportResult | null>(null);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.valor, 0), [rows]);

  const reset = () => {
    setFile(null);
    setRows([]);
    setPlanoContaId('');
    setError('');
    setResult(null);
  };

  const handleFile = async (nextFile: File | null) => {
    setFile(nextFile);
    setRows([]);
    setResult(null);
    setError('');
    if (!nextFile) return;

    try {
      const parsed = await parseReport(nextFile);
      const invalid = parsed.find(row => (
        !row.report_id
        || !row.data_lancamento
        || !row.unidade_codigo
        || !row.setor_codigo
        || row.valor <= 0
      ));
      if (invalid) {
        throw new Error('O arquivo possui linha sem Relatorio ID, Data, Unidade Codigo, Centro de Custo Codigo ou Valor. Gere novamente o relatorio na Folha ou em Beneficios.');
      }
      if (parsed.length === 0) throw new Error('Nenhuma linha valida foi encontrada no relatorio.');

      const reportIds = new Set(parsed.map(row => row.report_id));
      const sources = new Set(parsed.map(row => row.source));
      if (reportIds.size !== 1 || sources.size !== 1) {
        throw new Error('O arquivo mistura relatorios ou origens diferentes. Importe um relatorio gerado pelo sistema de cada vez.');
      }

      const uniqueRows = Array.from(new Map(
        parsed.map(row => [`${row.report_id}:${row.row_number}`, row]),
      ).values());
      setRows(uniqueRows);
    } catch (fileError: any) {
      setError(fileError.message || 'Nao foi possivel ler o relatorio.');
    }
  };

  const handleSubmit = async () => {
    if (!file || rows.length === 0) {
      setError('Selecione um relatorio gerado pela Folha ou por Beneficios.');
      return;
    }
    if (!planoContaId) {
      setError('Selecione a Conta Analitica que recebera as linhas do relatorio.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      setResult(await onImport(rows, planoContaId, file.name));
    } catch (importError: any) {
      setError(importError.message || 'Nao foi possivel importar o relatorio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1 border-primary/40 text-primary hover:bg-primary/10">
        <FileSpreadsheet className="w-4 h-4" /> Importar Relatorios
      </Button>

      <Dialog open={open} onOpenChange={next => {
        setOpen(next);
        if (!next) reset();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> Importar Relatorio Operacional
            </DialogTitle>
            <DialogDescription>
              Selecione o Excel gerado na Folha ou em Beneficios e informe a Conta Analitica para entrada na DRE.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Arquivo do relatorio *</Label>
              <Input type="file" accept=".xlsx,.xls" onChange={event => handleFile(event.target.files?.[0] || null)} />
            </div>
            <SearchableSelect label="Conta Analitica *" value={planoContaId} onChange={setPlanoContaId} options={contas} />
          </div>

          {rows.length > 0 && (
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div><span className="block text-xs text-muted-foreground">Origem</span><strong>{rows[0].source_label}</strong></div>
              <div><span className="block text-xs text-muted-foreground">Linhas</span><strong>{rows.length}</strong></div>
              <div><span className="block text-xs text-muted-foreground">Valor total</span><strong>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
              {result.inserted} linha(s) importadas e {result.skipped} ignorada(s).
              {result.errors.length > 0 ? ` ${result.errors[0]}` : ''}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            <Button onClick={handleSubmit} disabled={loading || rows.length === 0 || !planoContaId} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar para Lancamentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
