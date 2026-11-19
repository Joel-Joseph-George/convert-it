import { describe, it, expect } from 'vitest';
import { TOOLS } from '@/features/registry/tools';
import { searchTools, scoreTool } from '@/features/registry/search';

describe('Tool Search Scorer', () => {
  it('returns all tools when search query is empty', () => {
    const results = searchTools(TOOLS, '');
    expect(results.length).toBe(TOOLS.length);
  });

  it('filters by category when query is empty', () => {
    const audioTools = searchTools(TOOLS, '', 'audio');
    expect(audioTools.every((t) => t.category === 'audio')).toBe(true);
    expect(audioTools.length).toBeGreaterThan(0);
  });

  it('ranks exact and prefix matches highest', () => {
    const results = searchTools(TOOLS, 'pdf to word');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.id).toBe('pdf-to-word');
  });

  it('matches keyword search such as "xlsx" or "spreadsheet"', () => {
    const spreadsheetTools = searchTools(TOOLS, 'spreadsheet');
    const ids = spreadsheetTools.map((t) => t.id);
    expect(ids).toContain('excel-to-csv');
    expect(ids).toContain('csv-to-excel');
  });

  it('handles multi-term queries', () => {
    const results = searchTools(TOOLS, 'compress image');
    expect(results[0]?.id).toBe('image-compress');
  });

  it('returns empty array when query does not match any tool', () => {
    const results = searchTools(TOOLS, 'xyznonexistenttool12345');
    expect(results).toEqual([]);
  });

  it('calculates positive scores for matching tools', () => {
    const tool = TOOLS.find((t) => t.id === 'audio-convert');
    expect(tool).toBeDefined();
    if (!tool) return;
    const score = scoreTool(tool, 'audio');
    expect(score).toBeGreaterThan(0);
  });
});
