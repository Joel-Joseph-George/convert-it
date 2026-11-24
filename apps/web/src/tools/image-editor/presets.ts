/** Crop presets for the image editor. Ratios are width / height. */

export interface AspectPreset {
  id: string;
  label: string;
  /** null = free-form crop. */
  ratio: number | null;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];

export interface PassportPreset {
  id: string;
  label: string;
  /** Printed size in millimetres. */
  widthMm: number;
  heightMm: number;
  /** Allowed head height (chin to crown) in millimetres, used for the face guide. */
  headMinMm: number;
  headMaxMm: number;
}

export const PASSPORT_PRESETS: PassportPreset[] = [
  { id: 'in', label: 'India', widthMm: 35, heightMm: 45, headMinMm: 25, headMaxMm: 35 },
  { id: 'us', label: 'United States', widthMm: 51, heightMm: 51, headMinMm: 25, headMaxMm: 35 },
  { id: 'uk', label: 'United Kingdom', widthMm: 35, heightMm: 45, headMinMm: 29, headMaxMm: 34 },
  { id: 'schengen', label: 'Schengen / EU', widthMm: 35, heightMm: 45, headMinMm: 32, headMaxMm: 36 },
  { id: 'ca', label: 'Canada', widthMm: 50, heightMm: 70, headMinMm: 31, headMaxMm: 36 },
  { id: 'au', label: 'Australia', widthMm: 35, heightMm: 45, headMinMm: 32, headMaxMm: 36 },
];

/** Print resolution used for passport output and the print sheet. */
export const PRINT_DPI = 300;

export function mmToPx(mm: number, dpi = PRINT_DPI): number {
  return Math.round((mm / 25.4) * dpi);
}

export function getPassportPreset(id: string): PassportPreset | undefined {
  return PASSPORT_PRESETS.find((p) => p.id === id);
}
