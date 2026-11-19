export type Category =
  | 'pdf'
  | 'image'
  | 'audio'
  | 'video'
  | 'documents'
  | 'data'
  | 'archives'
  | 'text';

export type EngineKind = 'browser' | 'server';

export interface ToolOption {
  id: string;
  label: string;
  type: 'select' | 'slider' | 'toggle' | 'number' | 'text';
  default: string | number | boolean;
  choices?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  showWhen?: { optionId: string; equals: unknown };
  advanced?: boolean;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: Category;
  keywords: string[];
  popular?: boolean;
  inputs: {
    extensions: string[];
    mimeTypes: string[];
    multiple: boolean;
    maxFiles?: number;
  };
  outputs: { value: string; label: string }[];
  options: ToolOption[];
  engine: {
    kind: EngineKind;
    id: string;
  };
  limits: {
    maxFileSizeMB: number;
    maxFiles?: number;
  };
  badge?: 'best-effort';
  notes?: string;
}
