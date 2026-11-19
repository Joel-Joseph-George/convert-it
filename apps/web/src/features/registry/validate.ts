import { Category, ToolDefinition } from './types';
import { TOOLS, KNOWN_ENGINE_IDS } from './tools';

export const VALID_CATEGORIES: Set<Category> = new Set([
  'pdf',
  'image',
  'audio',
  'video',
  'documents',
  'data',
  'archives',
  'text',
]);

export interface ValidationError {
  toolId: string;
  field: string;
  message: string;
}

export function validateRegistry(tools: ToolDefinition[] = TOOLS): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenIds = new Set<string>();

  for (const tool of tools) {
    // 1. ID uniqueness and format
    if (!tool.id || typeof tool.id !== 'string') {
      errors.push({
        toolId: tool.id || 'unknown',
        field: 'id',
        message: 'Tool id must be a non-empty string.',
      });
    } else if (seenIds.has(tool.id)) {
      errors.push({
        toolId: tool.id,
        field: 'id',
        message: `Duplicate tool id "${tool.id}". Tool IDs must be unique.`,
      });
    } else {
      seenIds.add(tool.id);
    }

    // 2. Name & Description
    if (!tool.name || tool.name.trim() === '') {
      errors.push({
        toolId: tool.id,
        field: 'name',
        message: 'Tool name is required.',
      });
    }
    if (!tool.description || tool.description.trim() === '') {
      errors.push({
        toolId: tool.id,
        field: 'description',
        message: 'Tool description is required.',
      });
    }

    // 3. Category validity
    if (!VALID_CATEGORIES.has(tool.category)) {
      errors.push({
        toolId: tool.id,
        field: 'category',
        message: `Invalid category "${tool.category}". Must be one of: ${Array.from(VALID_CATEGORIES).join(', ')}.`,
      });
    }

    // 4. Engine verification
    if (!tool.engine || !tool.engine.id) {
      errors.push({
        toolId: tool.id,
        field: 'engine',
        message: 'Tool engine definition and id are required.',
      });
    } else if (!KNOWN_ENGINE_IDS.has(tool.engine.id)) {
      errors.push({
        toolId: tool.id,
        field: 'engine.id',
        message: `Unknown engine id "${tool.engine.id}". Must be registered in KNOWN_ENGINE_IDS.`,
      });
    }

    // 5. Inputs & Outputs
    if (!tool.inputs || !Array.isArray(tool.inputs.extensions) || tool.inputs.extensions.length === 0) {
      errors.push({
        toolId: tool.id,
        field: 'inputs.extensions',
        message: 'Tool must define at least one accepted input extension.',
      });
    }
    if (!tool.outputs || !Array.isArray(tool.outputs) || tool.outputs.length === 0) {
      errors.push({
        toolId: tool.id,
        field: 'outputs',
        message: 'Tool must define at least one target output format.',
      });
    }

    // 6. Limits
    if (!tool.limits || typeof tool.limits.maxFileSizeMB !== 'number' || tool.limits.maxFileSizeMB <= 0) {
      errors.push({
        toolId: tool.id,
        field: 'limits.maxFileSizeMB',
        message: 'Tool must specify a positive maxFileSizeMB limit.',
      });
    }
  }

  return errors;
}

// Run validation at startup
const startupValidationErrors = validateRegistry(TOOLS);
if (startupValidationErrors.length > 0) {
  console.error('ConvertIt Tool Registry Validation Failed:', startupValidationErrors);
}
