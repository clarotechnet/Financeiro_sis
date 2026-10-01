export interface PositionedPdfText {
  text: string;
  x: number;
  y: number;
}

export interface FlashPdfRow {
  cpf: string;
  valor: number;
}

const CPF_PREFIX_PATTERN = /\d{3}\.\d{3}\.\d{3}-\s*\d{0,2}/;
const MONEY_PATTERN = /(?:R\$\s*)?([\d.]+,\d{2})/;

const parseMoney = (value: string) => {
  const match = value.match(MONEY_PATTERN);
  if (!match) return 0;

  const parsed = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const findCpf = (anchor: PositionedPdfText, items: PositionedPdfText[]) => {
  const anchorDigits = anchor.text.replace(/\D/g, '');
  if (anchorDigits.length === 11) return anchorDigits;
  if (anchorDigits.length !== 9) return '';

  const suffix = items
    .filter(item => /^\d{2}$/.test(item.text.trim()) && Math.abs(item.y - anchor.y) <= 18)
    .sort((left, right) => {
      const leftDistance = Math.abs(left.y - anchor.y) + Math.abs(left.x - anchor.x) * 0.02;
      const rightDistance = Math.abs(right.y - anchor.y) + Math.abs(right.x - anchor.x) * 0.02;
      return leftDistance - rightDistance;
    })[0];

  return suffix ? `${anchorDigits}${suffix.text.trim()}` : '';
};

export const extractFlashRowsFromPage = (
  items: PositionedPdfText[],
  pageWidth: number,
): FlashPdfRow[] => {
  const rows: FlashPdfRow[] = [];
  const cpfAnchors = items.filter(item => CPF_PREFIX_PATTERN.test(item.text));

  cpfAnchors.forEach(anchor => {
    const cpf = findCpf(anchor, items);
    if (cpf.length !== 11) return;

    const total = items
      .filter(item => (
        item.x >= pageWidth * 0.8
        && Math.abs(item.y - anchor.y) <= 18
        && MONEY_PATTERN.test(item.text)
      ))
      .sort((left, right) => Math.abs(left.y - anchor.y) - Math.abs(right.y - anchor.y))[0];

    const valor = total ? parseMoney(total.text) : 0;
    if (valor > 0) rows.push({ cpf, valor });
  });

  return rows;
};
