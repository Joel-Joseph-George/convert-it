import { describe, it, expect } from 'vitest';
import { TOOLS, getToolById, getPopularTools } from '@/features/registry/tools';
import { validateRegistry, VALID_CATEGORIES } from '@/features/registry/validate';

describe('Tool Registry Validation', () => {
  it('validates all tools in the production registry with zero errors', () => {
    const errors = validateRegistry(TOOLS);
    expect(errors).toEqual([]);
  });

  it('enforces unique IDs across all tools', () => {
    const ids = TOOLS.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('ensures every tool belongs to a recognized category', () => {
    for (const tool of TOOLS) {
      expect(VALID_CATEGORIES.has(tool.category)).toBe(true);
    }
  });

  it('contains all required popular tools from Section 5.1', () => {
    const popular = getPopularTools();
    const popularIds = popular.map((t) => t.id);

    const expectedPopular = [
      'merge-pdf',
      'pdf-to-word',
      'image-compress',
      'audio-convert',
      'excel-to-csv',
      'video-to-gif',
      'heic-to-jpg',
      'chat-pdf',
    ];

    for (const id of expectedPopular) {
      expect(popularIds).toContain(id);
    }
  });

  it('flags duplicate IDs, missing fields, and unknown engines in faulty registry', () => {
    const invalidTools = [
      {
        id: 'dup-id',
        name: 'Tool 1',
        description: 'Description',
        category: 'pdf' as const,
        keywords: [],
        inputs: { extensions: ['pdf'], mimeTypes: ['application/pdf'], multiple: true },
        outputs: [{ value: 'pdf', label: 'PDF' }],
        options: [],
        engine: { kind: 'browser' as const, id: 'unknown-engine' },
        limits: { maxFileSizeMB: 10 },
      },
      {
        id: 'dup-id',
        name: '',
        description: '',
        category: 'invalid-cat' as unknown as import('@/features/registry/types').Category,
        keywords: [],
        inputs: { extensions: [], mimeTypes: [], multiple: true },
        outputs: [],
        options: [],
        engine: { kind: 'browser' as const, id: 'image-engine' },
        limits: { maxFileSizeMB: -5 },
      },
    ];

    const errors = validateRegistry(invalidTools);
    expect(errors.length).toBeGreaterThan(0);
    const errorMessages = errors.map((e) => e.message);
    expect(errorMessages.some((msg) => msg.includes('Duplicate tool id'))).toBe(true);
    expect(errorMessages.some((msg) => msg.includes('Unknown engine id'))).toBe(true);
    expect(errorMessages.some((msg) => msg.includes('Invalid category'))).toBe(true);
  });

  it('correctly retrieves tools by id', () => {
    const audio = getToolById('audio-convert');
    expect(audio).toBeDefined();
    expect(audio?.name).toBe('Audio Converter');

    const unknown = getToolById('non-existent-tool');
    expect(unknown).toBeUndefined();
  });
});
