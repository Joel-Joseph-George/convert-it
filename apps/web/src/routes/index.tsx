import * as React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Link as LinkIcon,
  ArrowRight,
  Upload,
  Zap,
  ShieldCheck,
  FileText,
  FileSpreadsheet,
  Music,
  Video,
  Image as ImageIcon,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const popularTools = [
  { id: 'merge-pdf', name: 'Merge PDF', icon: FileText },
  { id: 'pdf-to-word', name: 'PDF to Word', icon: FileText },
  { id: 'image-compress', name: 'Compress image', icon: Minimize2 },
  { id: 'audio-convert', name: 'MP3 to WAV', icon: Music },
  { id: 'excel-to-csv', name: 'Excel to CSV', icon: FileSpreadsheet },
  { id: 'video-to-gif', name: 'Video to GIF', icon: Video },
  { id: 'heic-to-jpg', name: 'HEIC to JPG', icon: ImageIcon },
  { id: 'images-to-pdf', name: 'Images to PDF', icon: ImageIcon },
];

function HomePage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-content space-y-10">
      {/* Hero Section */}
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span>FREE</span>
          <span>•</span>
          <span>NO ADS</span>
          <span>•</span>
          <span>NO SIGN-UP</span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
          Paste a link. Convert it.
        </h1>

        <p className="text-base text-muted-foreground max-w-md mx-auto">
          Download YouTube videos or audio, or convert any file right in your browser.
        </p>
      </div>

      {/* YouTube Link Ingestion Bar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-center gap-2 rounded-card border border-border bg-card p-1.5 shadow-none">
          <div className="flex flex-1 items-center gap-2 w-full px-3 py-1">
            <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="url"
              placeholder="Paste a YouTube link here"
              className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              readOnly
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="ghost" size="sm" className="text-xs font-medium text-muted-foreground">
              Paste
            </Button>
            <Button size="sm" className="w-full sm:w-auto text-xs font-medium gap-1">
              <span>Fetch Media</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Supports youtube.com and youtu.be links
          </span>
          <span>For personal use only.</span>
        </div>
      </div>

      {/* Quick Dropzone */}
      <div className="group flex flex-col items-center justify-center rounded-card border border-dashed border-border-dashed bg-card/50 p-8 text-center transition-colors hover:border-primary/50 hover:bg-card">
        <div className="flex h-10 w-10 items-center justify-center rounded-btn bg-primary/10 text-primary">
          <Upload className="h-5 w-5 stroke-[1.75]" />
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">
          Drop any local file here to transcode
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Privacy-guaranteed • Computations execute locally on device WebAssembly
        </p>
      </div>

      {/* Popular Tools Strip */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span>Popular tools</span>
          </div>
          <span className="text-muted-foreground">Client-side • Instant</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {popularTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.id}
                to="/tools"
                className="flex items-center gap-2.5 rounded-card border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-btn bg-muted text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 stroke-[1.75]" />
                </div>
                <span className="text-xs font-medium text-foreground truncate">
                  {tool.name}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex justify-center pt-2">
          <Link to="/tools">
            <Button variant="secondary" size="sm" className="text-xs gap-1.5">
              <span>Browse all tools</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Private by Architecture Callout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-card border border-border bg-card p-4 sm:p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Private by Architecture</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Zero data uploads for documents and conversions. Everything converts on your CPU utilizing WebAssembly and client-side memory.
          </p>
        </div>

        <div className="flex items-center gap-2 text-center text-xs w-full sm:w-auto">
          <div className="flex-1 sm:flex-initial rounded-btn border border-border bg-muted px-3 py-2">
            <div className="font-semibold text-foreground">100%</div>
            <div className="text-[10px] text-muted-foreground">In-Memory</div>
          </div>
          <div className="flex-1 sm:flex-initial rounded-btn border border-border bg-muted px-3 py-2">
            <div className="font-semibold text-foreground">0 bps</div>
            <div className="text-[10px] text-muted-foreground">Telemetry</div>
          </div>
        </div>
      </div>
    </div>
  );
}
