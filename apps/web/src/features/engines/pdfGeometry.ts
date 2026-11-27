/**
 * Map rectangles from a page *as displayed* (after its /Rotate, top-left
 * origin, fractions of the page) to pdf-lib draw options in the page's own
 * unrotated coordinates. Used to place signatures and OCR text layers.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A rectangle as fractions (0–1) of the displayed page, origin top-left. */
export interface FractionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Counter-clockwise degrees, as pdf-lib's `rotate`. */
  rotate: number;
}

function normalise(rotation: number): 0 | 90 | 180 | 270 {
  const r = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
  return r as 0 | 90 | 180 | 270;
}

/** Size of the page as the reader sees it. */
export function displaySize(
  rotation: number,
  box: Box,
): { width: number; height: number } {
  const r = normalise(rotation);
  return r === 90 || r === 270
    ? { width: box.height, height: box.width }
    : { width: box.width, height: box.height };
}

export function displayRectToPdf(
  rotation: number,
  box: Box,
  rect: FractionRect,
): Placement {
  const r = normalise(rotation);
  const { width: dw, height: dh } = displaySize(r, box);
  const width = rect.w * dw;
  const height = rect.h * dh;
  // Bottom-left corner in display space, y up.
  const vx = rect.x * dw;
  const vy = (1 - rect.y - rect.h) * dh;
  const { x: x0, y: y0, width: w, height: h } = box;
  switch (r) {
    case 90:
      return { x: x0 + w - vy, y: y0 + vx, width, height, rotate: 90 };
    case 180:
      return { x: x0 + w - vx, y: y0 + h - vy, width, height, rotate: 180 };
    case 270:
      return { x: x0 + vy, y: y0 + h - vx, width, height, rotate: 270 };
    default:
      return { x: x0 + vx, y: y0 + vy, width, height, rotate: 0 };
  }
}

/** Where to draw something that covers the whole displayed page. */
export function wholePagePlacement(rotation: number, box: Box): Placement {
  return displayRectToPdf(rotation, box, { x: 0, y: 0, w: 1, h: 1 });
}
