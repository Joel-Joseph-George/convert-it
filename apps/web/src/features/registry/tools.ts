import { ToolDefinition } from './types';

export const TOOLS: ToolDefinition[] = [
  // ==========================================
  // Image Tools (Browser)
  // ==========================================
  {
    id: 'image-convert',
    name: 'Image Converter',
    description: 'Convert between PNG, JPG, WEBP, and AVIF formats in your browser.',
    category: 'image',
    keywords: ['image', 'convert', 'png', 'jpg', 'jpeg', 'webp', 'avif', 'photos', 'picture'],
    inputs: {
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'avif'],
      mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
      multiple: true,
      maxFiles: 20,
    },
    outputs: [
      { value: 'webp', label: 'WEBP' },
      { value: 'png', label: 'PNG' },
      { value: 'jpg', label: 'JPG' },
      { value: 'avif', label: 'AVIF' },
    ],
    options: [
      {
        id: 'quality',
        label: 'Quality',
        type: 'slider',
        default: 85,
        min: 10,
        max: 100,
        step: 5,
      },
      {
        id: 'resize',
        label: 'Resize width (px)',
        type: 'number',
        default: 0,
        advanced: true,
      },
      {
        id: 'stripMetadata',
        label: 'Strip metadata for privacy',
        type: 'toggle',
        default: true,
        advanced: true,
      },
    ],
    engine: { kind: 'browser', id: 'image-engine' },
    limits: { maxFileSizeMB: 50, maxFiles: 20 },
  },
  {
    id: 'image-compress',
    name: 'Compress image',
    description: 'Reduce file size of JPG, PNG, and WebP images without visible quality loss.',
    category: 'image',
    keywords: ['compress', 'optimize', 'shrink', 'tinypng', 'size', 'lossless', 'image'],
    popular: true,
    inputs: {
      extensions: ['jpg', 'jpeg', 'png', 'webp'],
      mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      multiple: true,
      maxFiles: 20,
    },
    outputs: [
      { value: 'webp', label: 'WEBP' },
      { value: 'jpg', label: 'JPG' },
      { value: 'png', label: 'PNG' },
    ],
    options: [
      {
        id: 'compressionLevel',
        label: 'Compression level',
        type: 'select',
        default: 'balanced',
        choices: [
          { value: 'low', label: 'Low (Maximum quality)' },
          { value: 'balanced', label: 'Balanced (Recommended)' },
          { value: 'high', label: 'High (Smallest file)' },
        ],
      },
    ],
    engine: { kind: 'browser', id: 'image-engine' },
    limits: { maxFileSizeMB: 50, maxFiles: 20 },
  },
  {
    id: 'heic-to-jpg',
    name: 'HEIC to JPG',
    description: 'Convert Apple HEIC photos into universally compatible JPEG images.',
    category: 'image',
    keywords: ['heic', 'heif', 'iphone', 'apple', 'jpg', 'jpeg', 'photo'],
    popular: true,
    inputs: {
      extensions: ['heic', 'heif'],
      mimeTypes: ['image/heic', 'image/heif'],
      multiple: true,
      maxFiles: 20,
    },
    outputs: [
      { value: 'jpg', label: 'JPG' },
      { value: 'png', label: 'PNG' },
    ],
    options: [
      {
        id: 'quality',
        label: 'Quality',
        type: 'slider',
        default: 90,
        min: 50,
        max: 100,
        step: 5,
      },
    ],
    engine: { kind: 'browser', id: 'heic-engine' },
    limits: { maxFileSizeMB: 50, maxFiles: 20 },
  },
  {
    id: 'svg-to-png',
    name: 'SVG to PNG',
    description: 'Rasterize vector SVG files into high-resolution transparent PNG images.',
    category: 'image',
    keywords: ['svg', 'png', 'vector', 'rasterize', 'icon', 'logo'],
    inputs: {
      extensions: ['svg'],
      mimeTypes: ['image/svg+xml'],
      multiple: true,
      maxFiles: 20,
    },
    outputs: [
      { value: 'png', label: 'PNG' },
      { value: 'webp', label: 'WEBP' },
    ],
    options: [
      {
        id: 'scale',
        label: 'Scale Multiplier',
        type: 'select',
        default: '2',
        choices: [
          { value: '1', label: '1x (Original size)' },
          { value: '2', label: '2x (Retina HD)' },
          { value: '4', label: '4x (Ultra HD)' },
        ],
      },
    ],
    engine: { kind: 'browser', id: 'image-engine' },
    limits: { maxFileSizeMB: 20, maxFiles: 20 },
  },
  {
    id: 'image-resize',
    name: 'Resize Image',
    description: 'Change image dimensions by exact pixel measurements or percentage.',
    category: 'image',
    keywords: ['resize', 'scale', 'dimensions', 'width', 'height', 'pixels'],
    inputs: {
      extensions: ['png', 'jpg', 'jpeg', 'webp'],
      mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      multiple: true,
      maxFiles: 20,
    },
    outputs: [
      { value: 'same', label: 'Keep original format' },
      { value: 'png', label: 'PNG' },
      { value: 'jpg', label: 'JPG' },
      { value: 'webp', label: 'WEBP' },
    ],
    options: [
      {
        id: 'percentage',
        label: 'Scale percentage',
        type: 'slider',
        default: 50,
        min: 10,
        max: 200,
        step: 5,
      },
    ],
    engine: { kind: 'browser', id: 'image-engine' },
    limits: { maxFileSizeMB: 50, maxFiles: 20 },
  },

  // ==========================================
  // Audio Tools (Browser)
  // ==========================================
  {
    id: 'audio-convert',
    name: 'Audio Converter',
    description: 'Convert between MP3, WAV, AAC, FLAC, M4A, and OGG formats locally.',
    category: 'audio',
    keywords: ['audio', 'music', 'sound', 'mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'bitrate'],
    popular: true,
    inputs: {
      extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'aiff'],
      mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/flac', 'audio/ogg', 'audio/x-m4a'],
      multiple: true,
      maxFiles: 20,
    },
    outputs: [
      { value: 'mp3', label: 'MP3' },
      { value: 'wav', label: 'WAV' },
      { value: 'aac', label: 'AAC' },
      { value: 'flac', label: 'FLAC' },
      { value: 'ogg', label: 'OGG' },
      { value: 'm4a', label: 'M4A' },
    ],
    options: [
      {
        id: 'bitrate',
        label: 'Audio Bitrate',
        type: 'select',
        default: '320',
        choices: [
          { value: '128', label: '128 kbps (Standard)' },
          { value: '192', label: '192 kbps (Medium)' },
          { value: '256', label: '256 kbps (High)' },
          { value: '320', label: '320 kbps (Maximum)' },
        ],
      },
      {
        id: 'channels',
        label: 'Audio Channels',
        type: 'select',
        default: 'stereo',
        choices: [
          { value: 'stereo', label: 'Stereo (2 channels)' },
          { value: 'mono', label: 'Mono (1 channel)' },
        ],
        advanced: true,
      },
    ],
    engine: { kind: 'browser', id: 'ffmpeg-audio' },
    limits: { maxFileSizeMB: 300, maxFiles: 20 },
  },

  // ==========================================
  // Video Tools (Browser)
  // ==========================================
  {
    id: 'video-convert',
    name: 'Video Converter',
    description: 'Convert and remux video files between MP4 and WEBM in your browser.',
    category: 'video',
    keywords: ['video', 'mp4', 'webm', 'transcode', 'remux', 'clip', 'movie'],
    inputs: {
      extensions: ['mp4', 'webm', 'mov', 'mkv', 'avi'],
      mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'],
      multiple: false,
      maxFiles: 1,
    },
    outputs: [
      { value: 'mp4', label: 'MP4' },
      { value: 'webm', label: 'WEBM' },
    ],
    options: [
      {
        id: 'crf',
        label: 'Quality (CRF)',
        type: 'select',
        default: '23',
        choices: [
          { value: '18', label: 'Near Lossless (CRF 18)' },
          { value: '23', label: 'Balanced (CRF 23)' },
          { value: '28', label: 'Compact (CRF 28)' },
        ],
      },
    ],
    engine: { kind: 'browser', id: 'ffmpeg-video' },
    limits: { maxFileSizeMB: 200, maxFiles: 1 },
  },
  {
    id: 'video-to-gif',
    name: 'Video to GIF',
    description: 'Trim and convert short video clips into lightweight animated GIFs.',
    category: 'video',
    keywords: ['gif', 'video', 'animation', 'loop', 'clip', 'meme', 'mp4'],
    popular: true,
    inputs: {
      extensions: ['mp4', 'webm', 'mov'],
      mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
      multiple: false,
      maxFiles: 1,
    },
    outputs: [{ value: 'gif', label: 'GIF' }],
    options: [
      {
        id: 'fps',
        label: 'Frame Rate',
        type: 'select',
        default: '15',
        choices: [
          { value: '10', label: '10 FPS (Small size)' },
          { value: '15', label: '15 FPS (Smooth)' },
          { value: '24', label: '24 FPS (Cinematic)' },
        ],
      },
      {
        id: 'scaleWidth',
        label: 'Width (px)',
        type: 'select',
        default: '480',
        choices: [
          { value: '320', label: '320px (Tiny)' },
          { value: '480', label: '480px (Standard)' },
          { value: '640', label: '640px (High Res)' },
        ],
        advanced: true,
      },
    ],
    engine: { kind: 'browser', id: 'ffmpeg-video' },
    limits: { maxFileSizeMB: 100, maxFiles: 1 },
  },
  {
    id: 'video-to-audio',
    name: 'Extract Audio from Video',
    description: 'Extract pristine audio soundtracks from video files without re-encoding.',
    category: 'video',
    keywords: ['video', 'audio', 'extract', 'soundtrack', 'mp3', 'aac', 'rip'],
    inputs: {
      extensions: ['mp4', 'webm', 'mov', 'mkv'],
      mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [
      { value: 'mp3', label: 'MP3' },
      { value: 'm4a', label: 'M4A' },
      { value: 'wav', label: 'WAV' },
    ],
    options: [
      {
        id: 'bitrate',
        label: 'Audio Bitrate',
        type: 'select',
        default: '256',
        choices: [
          { value: '192', label: '192 kbps' },
          { value: '256', label: '256 kbps' },
          { value: '320', label: '320 kbps' },
        ],
      },
    ],
    engine: { kind: 'browser', id: 'ffmpeg-audio' },
    limits: { maxFileSizeMB: 200, maxFiles: 10 },
  },

  // ==========================================
  // Data Tools (Browser)
  // ==========================================
  {
    id: 'excel-to-csv',
    name: 'Excel to CSV',
    description: 'Export Excel sheets and workbooks to clean delimiter-separated text.',
    category: 'data',
    keywords: ['excel', 'csv', 'sheets', 'xlsx', 'xls', 'spreadsheet', 'export', 'data', 'table'],
    popular: true,
    inputs: {
      extensions: ['xlsx', 'xls'],
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'csv', label: 'CSV' }],
    options: [
      {
        id: 'delimiter',
        label: 'Delimiter',
        type: 'select',
        default: ',',
        choices: [
          { value: ',', label: 'Comma (,)' },
          { value: ';', label: 'Semicolon (;)' },
          { value: '\t', label: 'Tab (\\t)' },
        ],
      },
    ],
    engine: { kind: 'browser', id: 'sheetjs-data' },
    limits: { maxFileSizeMB: 50, maxFiles: 10 },
  },
  {
    id: 'csv-to-excel',
    name: 'CSV to Excel',
    description: 'Transform CSV data into formatted Microsoft Excel (.xlsx) spreadsheets.',
    category: 'data',
    keywords: ['csv', 'excel', 'xlsx', 'spreadsheet', 'table', 'data'],
    inputs: {
      extensions: ['csv', 'tsv', 'txt'],
      mimeTypes: ['text/csv', 'text/tab-separated-values', 'text/plain'],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'xlsx', label: 'XLSX' }],
    options: [],
    engine: { kind: 'browser', id: 'sheetjs-data' },
    limits: { maxFileSizeMB: 50, maxFiles: 10 },
  },
  {
    id: 'json-to-csv',
    name: 'JSON to CSV',
    description: 'Flatten structured JSON objects or records into tabular CSV format.',
    category: 'data',
    keywords: ['json', 'csv', 'flatten', 'tabular', 'schema', 'export'],
    inputs: {
      extensions: ['json'],
      mimeTypes: ['application/json'],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'csv', label: 'CSV' }],
    options: [
      {
        id: 'delimiter',
        label: 'Delimiter',
        type: 'select',
        default: ',',
        choices: [
          { value: ',', label: 'Comma (,)' },
          { value: ';', label: 'Semicolon (;)' },
          { value: '\t', label: 'Tab (\\t)' },
        ],
      },
    ],
    engine: { kind: 'browser', id: 'sheetjs-data' },
    limits: { maxFileSizeMB: 50, maxFiles: 10 },
  },
  {
    id: 'csv-to-json',
    name: 'CSV to JSON',
    description: 'Parse CSV files into clean JSON arrays of objects with typed columns.',
    category: 'data',
    keywords: ['csv', 'json', 'parse', 'object', 'records', 'api'],
    inputs: {
      extensions: ['csv', 'tsv'],
      mimeTypes: ['text/csv', 'text/tab-separated-values'],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'json', label: 'JSON' }],
    options: [
      {
        id: 'firstRowHeader',
        label: 'First row is header',
        type: 'toggle',
        default: true,
      },
    ],
    engine: { kind: 'browser', id: 'sheetjs-data' },
    limits: { maxFileSizeMB: 50, maxFiles: 10 },
  },
  {
    id: 'excel-to-json',
    name: 'Excel to JSON',
    description: 'Convert Excel workbook sheets directly into structured JSON data.',
    category: 'data',
    keywords: ['excel', 'xlsx', 'json', 'export', 'data', 'sheets'],
    inputs: {
      extensions: ['xlsx', 'xls'],
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'json', label: 'JSON' }],
    options: [
      {
        id: 'sheet',
        label: 'Sheet selector',
        type: 'select',
        default: 'all',
        choices: [
          { value: 'all', label: 'All sheets' },
          { value: 'first', label: 'First sheet only' },
        ],
      },
    ],
    engine: { kind: 'browser', id: 'sheetjs-data' },
    limits: { maxFileSizeMB: 50, maxFiles: 10 },
  },
  {
    id: 'json-to-excel',
    name: 'JSON to Excel',
    description: 'Generate styled Excel spreadsheets from JSON arrays or datasets.',
    category: 'data',
    keywords: ['json', 'excel', 'xlsx', 'spreadsheet', 'table'],
    inputs: {
      extensions: ['json'],
      mimeTypes: ['application/json'],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'xlsx', label: 'XLSX' }],
    options: [],
    engine: { kind: 'browser', id: 'sheetjs-data' },
    limits: { maxFileSizeMB: 50, maxFiles: 10 },
  },

  // ==========================================
  // PDF Tools (Browser)
  // ==========================================
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Combine multiple PDF documents into one single ordered PDF file.',
    category: 'pdf',
    keywords: ['pdf', 'merge', 'combine', 'join', 'documents', 'order'],
    popular: true,
    inputs: {
      extensions: ['pdf'],
      mimeTypes: ['application/pdf'],
      multiple: true,
      maxFiles: 20,
    },
    outputs: [{ value: 'pdf', label: 'PDF' }],
    options: [],
    engine: { kind: 'browser', id: 'pdf-engine' },
    limits: { maxFileSizeMB: 100, maxFiles: 20 },
  },
  {
    id: 'split-pdf',
    name: 'Split PDF',
    description: 'Split a PDF into separate single-page documents or custom page ranges.',
    category: 'pdf',
    keywords: ['pdf', 'split', 'extract', 'pages', 'divide'],
    inputs: {
      extensions: ['pdf'],
      mimeTypes: ['application/pdf'],
      multiple: false,
      maxFiles: 1,
    },
    outputs: [{ value: 'pdf', label: 'PDF' }],
    options: [
      {
        id: 'pageRange',
        label: 'Page range (e.g. 1-3, 5)',
        type: 'text',
        default: 'all',
      },
    ],
    engine: { kind: 'browser', id: 'pdf-engine' },
    limits: { maxFileSizeMB: 100, maxFiles: 1 },
  },
  {
    id: 'rotate-pdf',
    name: 'Rotate PDF',
    description: 'Rotate all or selected pages in a PDF document by 90, 180, or 270 degrees.',
    category: 'pdf',
    keywords: ['pdf', 'rotate', 'orientation', 'upside down', 'landscape'],
    inputs: {
      extensions: ['pdf'],
      mimeTypes: ['application/pdf'],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'pdf', label: 'PDF' }],
    options: [
      {
        id: 'angle',
        label: 'Rotation angle',
        type: 'select',
        default: '90',
        choices: [
          { value: '90', label: '90° Clockwise' },
          { value: '180', label: '180°' },
          { value: '270', label: '270° (90° Counter-clockwise)' },
        ],
      },
    ],
    engine: { kind: 'browser', id: 'pdf-engine' },
    limits: { maxFileSizeMB: 100, maxFiles: 10 },
  },
  {
    id: 'remove-pdf-pages',
    name: 'Remove PDF Pages',
    description: 'Delete unwanted or blank pages from any PDF document.',
    category: 'pdf',
    keywords: ['pdf', 'remove', 'delete', 'pages', 'cut', 'filter'],
    inputs: {
      extensions: ['pdf'],
      mimeTypes: ['application/pdf'],
      multiple: false,
      maxFiles: 1,
    },
    outputs: [{ value: 'pdf', label: 'PDF' }],
    options: [
      {
        id: 'pagesToRemove',
        label: 'Pages to remove (comma-separated, e.g. 2, 4)',
        type: 'text',
        default: '',
      },
    ],
    engine: { kind: 'browser', id: 'pdf-engine' },
    limits: { maxFileSizeMB: 100, maxFiles: 1 },
  },
  {
    id: 'images-to-pdf',
    name: 'Images to PDF',
    description: 'Bundle multiple PNG, JPG, or WEBP photos into a single PDF document.',
    category: 'pdf',
    keywords: ['images', 'pdf', 'photos', 'album', 'scan', 'bundle', 'jpg to pdf', 'png to pdf'],
    popular: true,
    inputs: {
      extensions: ['png', 'jpg', 'jpeg', 'webp'],
      mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      multiple: true,
      maxFiles: 50,
    },
    outputs: [{ value: 'pdf', label: 'PDF' }],
    options: [
      {
        id: 'fit',
        label: 'Page fit',
        type: 'select',
        default: 'fit',
        choices: [
          { value: 'fit', label: 'Fit to standard A4' },
          { value: 'original', label: 'Match image dimensions' },
        ],
      },
    ],
    engine: { kind: 'browser', id: 'pdf-engine' },
    limits: { maxFileSizeMB: 100, maxFiles: 50 },
  },
  {
    id: 'pdf-to-images',
    name: 'PDF to Images',
    description: 'Render and extract high-resolution PNG or JPG images from PDF pages.',
    category: 'pdf',
    keywords: ['pdf', 'images', 'png', 'jpg', 'extract', 'render', 'pages'],
    inputs: {
      extensions: ['pdf'],
      mimeTypes: ['application/pdf'],
      multiple: false,
      maxFiles: 1,
    },
    outputs: [
      { value: 'png', label: 'PNG' },
      { value: 'jpg', label: 'JPG' },
    ],
    options: [
      {
        id: 'dpi',
        label: 'Resolution (DPI)',
        type: 'select',
        default: '150',
        choices: [
          { value: '72', label: '72 DPI (Web preview)' },
          { value: '150', label: '150 DPI (Standard)' },
          { value: '300', label: '300 DPI (Print ready)' },
        ],
      },
    ],
    engine: { kind: 'browser', id: 'pdf-render' },
    limits: { maxFileSizeMB: 100, maxFiles: 1 },
  },
  {
    id: 'pdf-to-text',
    name: 'PDF to Text',
    description: 'Extract raw selectable text content from PDF documents.',
    category: 'pdf',
    keywords: ['pdf', 'text', 'extract', 'txt', 'copy', 'content'],
    inputs: {
      extensions: ['pdf'],
      mimeTypes: ['application/pdf'],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'txt', label: 'TXT' }],
    options: [],
    engine: { kind: 'browser', id: 'pdf-render' },
    limits: { maxFileSizeMB: 50, maxFiles: 10 },
  },

  // ==========================================
  // Text Tools (Browser)
  // ==========================================
  {
    id: 'markdown-to-html',
    name: 'Markdown to HTML',
    description: 'Compile GitHub-Flavored Markdown into clean, accessible HTML markup.',
    category: 'text',
    keywords: ['markdown', 'html', 'md', 'compile', 'format', 'gfm'],
    inputs: {
      extensions: ['md', 'markdown', 'txt'],
      mimeTypes: ['text/markdown', 'text/plain'],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'html', label: 'HTML' }],
    options: [],
    engine: { kind: 'browser', id: 'text-engine' },
    limits: { maxFileSizeMB: 10, maxFiles: 10 },
  },
  {
    id: 'html-to-markdown',
    name: 'HTML to Markdown',
    description: 'Convert web pages or HTML snippets back into structured Markdown syntax.',
    category: 'text',
    keywords: ['html', 'markdown', 'md', 'convert', 'turndown'],
    inputs: {
      extensions: ['html', 'htm'],
      mimeTypes: ['text/html'],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'md', label: 'MD' }],
    options: [],
    engine: { kind: 'browser', id: 'text-engine' },
    limits: { maxFileSizeMB: 10, maxFiles: 10 },
  },

  // ==========================================
  // Server Document Tools (Phase 5)
  // ==========================================
  {
    id: 'word-to-pdf',
    name: 'Word to PDF',
    description: 'Convert Microsoft Word DOCX and DOC documents into pristine PDF files.',
    category: 'documents',
    keywords: ['word', 'doc', 'docx', 'pdf', 'libreoffice', 'convert'],
    inputs: {
      extensions: ['docx', 'doc'],
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
      ],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'pdf', label: 'PDF' }],
    options: [],
    engine: { kind: 'server', id: 'libreoffice' },
    limits: { maxFileSizeMB: 25, maxFiles: 10 },
  },
  {
    id: 'powerpoint-to-pdf',
    name: 'PowerPoint to PDF',
    description: 'Convert PowerPoint PPTX slide presentations into high-fidelity PDFs.',
    category: 'documents',
    keywords: ['powerpoint', 'pptx', 'ppt', 'slides', 'presentation', 'pdf'],
    inputs: {
      extensions: ['pptx', 'ppt'],
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
      ],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'pdf', label: 'PDF' }],
    options: [],
    engine: { kind: 'server', id: 'libreoffice' },
    limits: { maxFileSizeMB: 25, maxFiles: 10 },
  },
  {
    id: 'excel-to-pdf',
    name: 'Excel to PDF',
    description: 'Render Excel workbooks and sheets directly as paginated PDF documents.',
    category: 'documents',
    keywords: ['excel', 'xlsx', 'xls', 'pdf', 'sheets', 'libreoffice'],
    inputs: {
      extensions: ['xlsx', 'xls'],
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
      multiple: true,
      maxFiles: 10,
    },
    outputs: [{ value: 'pdf', label: 'PDF' }],
    options: [],
    engine: { kind: 'server', id: 'libreoffice' },
    limits: { maxFileSizeMB: 25, maxFiles: 10 },
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word',
    description: 'Convert PDF files into editable Microsoft Word (.docx) documents.',
    category: 'documents',
    keywords: ['pdf', 'word', 'docx', 'convert', 'editable', 'doc'],
    popular: true,
    badge: 'best-effort',
    inputs: {
      extensions: ['pdf'],
      mimeTypes: ['application/pdf'],
      multiple: true,
      maxFiles: 5,
    },
    outputs: [{ value: 'docx', label: 'DOCX' }],
    options: [],
    engine: { kind: 'server', id: 'pdf2docx' },
    limits: { maxFileSizeMB: 25, maxFiles: 5 },
    notes: 'Preserves fonts, paragraphs, and layouts. Scanned documents may require OCR.',
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF to Excel',
    description: 'Extract tabular data from PDF documents directly into clean Excel spreadsheets.',
    category: 'documents',
    keywords: ['pdf', 'excel', 'xlsx', 'table', 'extract', 'spreadsheet', 'data'],
    badge: 'best-effort',
    inputs: {
      extensions: ['pdf'],
      mimeTypes: ['application/pdf'],
      multiple: true,
      maxFiles: 5,
    },
    outputs: [
      { value: 'xlsx', label: 'XLSX' },
      { value: 'csv', label: 'CSV' },
    ],
    options: [
      {
        id: 'mode',
        label: 'Table detection mode',
        type: 'select',
        default: 'lattice',
        choices: [
          { value: 'lattice', label: 'Lattice (explicit grid lines)' },
          { value: 'stream', label: 'Stream (whitespace separated)' },
        ],
      },
    ],
    engine: { kind: 'server', id: 'pdfplumber' },
    limits: { maxFileSizeMB: 25, maxFiles: 5 },
    notes: 'Works best on PDFs with real tables. Scanned PDFs may need OCR.',
  },
];

export const KNOWN_ENGINE_IDS = new Set([
  'image-engine',
  'heic-engine',
  'ffmpeg-audio',
  'ffmpeg-video',
  'sheetjs-data',
  'pdf-engine',
  'pdf-render',
  'text-engine',
  'libreoffice',
  'pdf2docx',
  'pdfplumber',
]);

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

export function getPopularTools(): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.popular);
}

export function getToolsByCategory(category: string): ToolDefinition[] {
  if (category === 'all') return TOOLS;
  return TOOLS.filter((tool) => tool.category === category);
}
