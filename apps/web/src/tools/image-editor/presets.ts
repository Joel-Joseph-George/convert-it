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

/** Fixed output sizes for social media posts, covers and thumbnails. */
export interface SocialPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const SOCIAL_PRESETS: SocialPreset[] = [
  { id: 'ig-square', label: 'Instagram post (square)', width: 1080, height: 1080 },
  { id: 'ig-portrait', label: 'Instagram post (portrait)', width: 1080, height: 1350 },
  { id: 'story', label: 'Story / Reel (Instagram, TikTok)', width: 1080, height: 1920 },
  { id: 'x-post', label: 'X / Twitter post', width: 1600, height: 900 },
  { id: 'fb-post', label: 'Facebook / LinkedIn post', width: 1200, height: 630 },
  { id: 'yt-thumb', label: 'YouTube thumbnail', width: 1280, height: 720 },
  { id: 'fb-cover', label: 'Facebook cover', width: 1640, height: 624 },
  { id: 'li-banner', label: 'LinkedIn banner', width: 1584, height: 396 },
  { id: 'x-header', label: 'X / Twitter header', width: 1500, height: 500 },
  { id: 'avatar', label: 'Profile picture', width: 800, height: 800 },
];

export function getSocialPreset(id: string): SocialPreset | undefined {
  return SOCIAL_PRESETS.find((p) => p.id === id);
}

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
