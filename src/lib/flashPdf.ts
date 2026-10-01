import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { BeneficioImportRow } from '@/types/beneficios';
import { extractFlashRowsFromPage, PositionedPdfText } from '@/lib/flashPdfParser';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const parseFlashPdf = async (file: File): Promise<BeneficioImportRow[]> => {
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;
  const rows: BeneficioImportRow[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const pageWidth = page.view[2] - page.view[0];
      const content = await page.getTextContent();
      const items: PositionedPdfText[] = content.items.flatMap(item => {
        if (!('str' in item) || !item.str.trim()) return [];
        return [{ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }];
      });
      rows.push(...extractFlashRowsFromPage(items, pageWidth));
    }
  } finally {
    await pdf.destroy();
  }

  return rows;
};
