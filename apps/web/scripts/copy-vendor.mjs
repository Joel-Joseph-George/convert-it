import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicVendor = path.resolve(__dirname, '../public/vendor');

fs.mkdirSync(path.join(publicVendor, 'ffmpeg'), { recursive: true });
fs.mkdirSync(path.join(publicVendor, 'pdfjs'), { recursive: true });

// Locate @ffmpeg/core dist
const rootFfmpeg = path.resolve(__dirname, '../../../node_modules/@ffmpeg/core/dist/esm');
const monorepoFfmpeg = path.resolve(__dirname, '../../node_modules/@ffmpeg/core/dist/esm');
const localFfmpeg = path.resolve(__dirname, '../node_modules/@ffmpeg/core/dist/esm');
const ffmpegSource = [rootFfmpeg, monorepoFfmpeg, localFfmpeg].find((p) => fs.existsSync(p));

if (ffmpegSource) {
  for (const file of fs.readdirSync(ffmpegSource)) {
    if (file.startsWith('ffmpeg-core.')) {
      fs.copyFileSync(path.join(ffmpegSource, file), path.join(publicVendor, 'ffmpeg', file));
    }
  }
}

// Locate pdfjs-dist worker
const rootPdfjs = path.resolve(__dirname, '../../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const monorepoPdfjs = path.resolve(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const localPdfjs = path.resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const pdfjsSource = [rootPdfjs, monorepoPdfjs, localPdfjs].find((p) => fs.existsSync(p));

if (pdfjsSource) {
  fs.copyFileSync(pdfjsSource, path.join(publicVendor, 'pdfjs/pdf.worker.min.mjs'));
}
