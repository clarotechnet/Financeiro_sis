import type { CSSProperties } from 'react';

export const chartTooltipContentStyle: CSSProperties = {
  backgroundColor: '#7f1d1d',
  border: '1px solid rgba(248, 113, 113, 0.75)',
  borderRadius: 8,
  boxShadow: '0 18px 45px rgba(0, 0, 0, 0.35)',
  color: '#ffffff',
  padding: '10px 12px',
};

export const chartTooltipLabelStyle: CSSProperties = {
  color: '#ffffff',
  fontWeight: 800,
  marginBottom: 6,
};

export const chartTooltipItemStyle: CSSProperties = {
  color: '#ffffff',
  fontWeight: 700,
  padding: '2px 0',
};

export const chartTooltipCursor = {
  fill: 'rgba(239, 68, 68, 0.12)',
};
