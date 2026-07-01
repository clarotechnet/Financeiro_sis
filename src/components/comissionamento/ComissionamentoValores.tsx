import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { LancamentoPix } from '@/types/comissionamento';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  data: LancamentoPix[];
}

interface Row {
  favorecido: string;
  cidade: string;
  contaAnalitica: string;
  // totalOS: number;
  totalValor: number;
}

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ComissionamentoValores: React.FC<Props> = ({ data }) => {
  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    data.forEach(r => {
      const fav = r.favorecido || '';
      if (!fav) return;
      const contaAnalitica = r.conta_analitica || '-';
      const key = `${fav}|${contaAnalitica}`;
      if (!map.has(key)) {
        map.set(key, {
          favorecido: fav,
          cidade: r.unidade || '-',
          contaAnalitica,
          // totalOS: 0,
          totalValor: 0,
        });
      }
      const it = map.get(key)!;
      // it.totalOS += 1;
      it.totalValor += r.valor || 0;
      if (r.unidade && it.cidade === '-') it.cidade = r.unidade;
    });
    return Array.from(map.values()).sort((a, b) => b.totalValor - a.totalValor);
  }, [data]);

  // const totalGeralOS = useMemo(() => rows.reduce((s, r) => s + r.totalOS, 0), [rows]);
  const totalGeralValor = useMemo(() => rows.reduce((s, r) => s + r.totalValor, 0), [rows]);

  const exportExcel = () => {
    const exportData = rows.map(r => ({
      Favorecido: r.favorecido,
      Cidade: r.cidade,
      'Conta Analítica': r.contaAnalitica,
      // 'Total OS': r.totalOS,
      'Total R$': r.totalValor,
    }));
    exportData.push({
      Favorecido: 'TOTAL GERAL',
      Cidade: '',
      'Conta Analítica': '',
      // 'Total OS': totalGeralOS,
      'Total R$': totalGeralValor,
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Valores');
    XLSX.writeFile(wb, `relatorio-valores-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Valores', 14, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 25);

    autoTable(doc, {
      startY: 30,
      head: [['Favorecido', 'Cidade', 'Conta Analítica', 'Total R$']],
      body: rows.map(r => [
        r.favorecido,
        r.cidade,
        r.contaAnalitica,
        // r.totalOS.toString(),
        fmtBRL(r.totalValor),
      ]),
      foot: [[
        { content: 'TOTAL GERAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        // { content: totalGeralOS.toString(), styles: { fontStyle: 'bold' } },
        { content: fmtBRL(totalGeralValor), styles: { fontStyle: 'bold' } },
      ]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255 },
      footStyles: { fillColor: [240, 240, 240], textColor: 30 },
    });

    doc.save(`relatorio-valores-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={exportPDF}>
          <FileText className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
        <Button variant="outline" size="sm" onClick={exportExcel}>
          <Download className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      <div className="card overflow-hidden ">
        <div className="overflow-x-auto ">
          <table className="data-table w-full">
            <thead>
              <tr className=''>
                <th className="text-left">Favorecido</th>
                <th className="text-left">Cidade</th>
                <th className="text-left">Conta Analítica</th>
                {/* <th className="text-right">Total OS</th> */}
                <th className="text-right ">Total R$</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="font-medium text-primary">{r.favorecido}</td>
                  <td className="text-accent">{r.cidade}</td>
                  <td>{r.contaAnalitica}</td>
                  {/* <td className="text-right font-bold">{r.totalOS}</td> */}
                  <td className="text-right font-bold text-destructive">{fmtBRL(r.totalValor)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-muted-foreground">
                    Nenhum favorecido encontrado.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 font-bold">
                  <td colSpan={3} className="text-left">TOTAL GERAL</td>
                  {/* <td className="text-right">{totalGeralOS}</td> */}
                  <td className="text-right text-destructive">{fmtBRL(totalGeralValor)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
