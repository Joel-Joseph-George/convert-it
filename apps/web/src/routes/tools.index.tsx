import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Search,
  FileText,
  FileSpreadsheet,
  Music,
  Video,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';

export const Route = createFileRoute('/tools/')({
  component: ToolsPage,
});

const sampleTools = [
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Combine multiple PDF documents into one ordered file.',
    engine: 'browser',
    category: 'pdf',
    icon: FileText,
    formats: ['PDF → PDF', 'WASM Core'],
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word',
    description: 'Convert PDF files into editable DOCX documents.',
    engine: 'server',
    category: 'documents',
    icon: FileText,
    formats: ['PDF → DOCX', 'High Fidelity'],
  },
  {
    id: 'image-compress',
    name: 'Compress image',
    description: 'Shrink PNG, JPG, and WEBP file sizes without visible quality loss.',
    engine: 'browser',
    category: 'image',
    icon: ImageIcon,
    formats: ['PNG • JPG • WEBP', 'MozJPEG / Oxipng'],
  },
  {
    id: 'audio-convert',
    name: 'Audio Transcoder',
    description: 'Convert between MP3, WAV, AAC, FLAC, and OGG formats locally.',
    engine: 'browser',
    category: 'audio',
    icon: Music,
    formats: ['MP3 • WAV • AAC', 'FFmpeg WASM'],
  },
  {
    id: 'excel-to-csv',
    name: 'Excel to CSV',
    description: 'Export Excel sheets and workbooks to clean delimiter-separated text.',
    engine: 'browser',
    category: 'data',
    icon: FileSpreadsheet,
    formats: ['XLSX → CSV', 'Multi-Sheet'],
  },
  {
    id: 'video-to-gif',
    name: 'Video to GIF',
    description: 'Trim and convert short video clips into lightweight animated GIFs.',
    engine: 'browser',
    category: 'video',
    icon: Video,
    formats: ['MP4 • WEBM → GIF', 'FFmpeg WASM'],
  },
];

const categories = [
  { id: 'all', label: 'All' },
  { id: 'pdf', label: 'PDF' },
  { id: 'image', label: 'Image' },
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
  { id: 'documents', label: 'Documents' },
  { id: 'data', label: 'Data' },
  { id: 'archives', label: 'Archives' },
  { id: 'text', label: 'Text' },
];

function ToolsPage(): React.ReactElement {
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredTools = sampleTools.filter((tool) => {
    const matchesCategory =
      selectedCategory === 'all' || tool.category === selectedCategory;
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-grid space-y-8">
      {/* Page Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span>24 tools available • Client-first architecture</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl text-foreground">
          All tools
        </h1>
        <p className="text-sm text-muted-foreground">
          Search or browse. Everything is free and ad-free.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tools, e.g. PDF to Word, MP3, compress"
          className="h-11 w-full rounded-card border border-border bg-card pl-10 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </div>
      </div>

      {/* Category Chips */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-chip px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              className="flex flex-col justify-between rounded-card border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-btn bg-primary/10 text-primary">
                    <Icon className="h-4 w-4 stroke-[1.75]" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        tool.engine === 'browser' ? 'bg-success' : 'bg-muted-foreground'
                      }`}
                    />
                    {tool.engine === 'browser' ? 'In your browser' : 'Server'}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {tool.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {tool.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5 pt-2 border-t border-border">
                {tool.formats.map((fmt) => (
                  <span
                    key={fmt}
                    className="rounded-chip bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Privacy Guarantee Note */}
      <div className="flex items-center gap-3 rounded-card border border-border bg-card p-4 text-xs">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
        <div className="space-y-0.5">
          <div className="font-medium text-foreground">Privacy First Guarantee</div>
          <p className="text-muted-foreground">
            Tools labeled "In your browser" execute locally via WebAssembly. Your files never touch a server.
          </p>
        </div>
      </div>
    </div>
  );
}
