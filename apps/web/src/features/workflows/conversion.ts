import { runConversion } from '../engines/registry';
import { EngineError, type ConvertContext } from '../engines/types';
import { getToolById, TOOLS } from '../registry/tools';
import type { ToolDefinition } from '../registry/types';
import { runServerConversion } from '../server/serverConversion';

export type Options = Record<string, string | number | boolean>;
export interface Step {
  toolId: string;
  format: string;
  options: Options;
}

export function defaultStep(tool: ToolDefinition): Step {
  return {
    toolId: tool.id,
    format: tool.outputs[0]?.value ?? '',
    options: Object.fromEntries(
      tool.options.map((option) => [option.id, option.default])
    ),
  };
}

export function nextTools(previous: Step): ToolDefinition[] {
  const extensions =
    previous.format === 'same'
      ? (getToolById(previous.toolId)?.inputs.extensions ?? [])
      : [previous.format];
  return TOOLS.filter(
    (tool) =>
      !['chat-pdf', 'image-editor', 'youtube'].includes(tool.id) &&
      extensions.length > 0 &&
      extensions.every((ext) => tool.inputs.extensions.includes(ext))
  );
}

export function combinesFiles(step: Step): boolean {
  return step.toolId === 'merge-pdf' || step.toolId === 'images-to-pdf';
}

export interface Output {
  filename: string;
  blob: Blob;
  sizeBytes: number;
}

export async function runWorkflow(
  steps: Step[],
  inputs: File[],
  ctx: ConvertContext
): Promise<Output[]> {
  let files = inputs;
  let outputs: Output[] = [];
  for (const [index, step] of steps.entries()) {
    const tool = getToolById(step.toolId);
    if (!tool || !tool.outputs.some((output) => output.value === step.format)) {
      throw new EngineError(
        'TOOL_DISABLED',
        'This conversion is no longer available.'
      );
    }
    outputs = [];
    const batches = combinesFiles(step) ? [files] : files.map((file) => [file]);
    for (const [batchIndex, batch] of batches.entries()) {
      ctx.signal?.throwIfAborted();
      const input = batch[0];
      if (!input)
        throw new EngineError('CONVERSION_FAILED', 'Choose a file to convert.');
      const limit = tool.inputs.maxFiles ?? tool.limits.maxFiles;
      if (index > 0 && limit && batch.length > limit) {
        throw new EngineError(
          'TOO_MANY_FILES',
          `${tool.name} accepts up to ${limit} files per run.`
        );
      }
      if (index > 0) {
        for (const file of batch) {
          const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
          if (!tool.inputs.extensions.includes(extension)) {
            throw new EngineError(
              'UNSUPPORTED_FILE_TYPE',
              `${tool.name} cannot use the previous output "${file.name}".`
            );
          }
          if (file.size > tool.limits.maxFileSizeMB * 1024 * 1024) {
            throw new EngineError(
              'FILE_TOO_LARGE',
              `The intermediate file exceeds the ${tool.limits.maxFileSizeMB} MB limit for ${tool.name}.`
            );
          }
        }
      }
      const context = {
        signal: ctx.signal,
        onProgress: (percent: number) =>
          ctx.onProgress(
            Math.round(
              ((index + (batchIndex + percent / 100) / batches.length) * 100) /
                steps.length
            )
          ),
      };
      const results =
        tool.engine.kind === 'server'
          ? [
              await runServerConversion(
                tool.id,
                input,
                { ...step.options, format: step.format },
                context
              ),
            ]
          : await runConversion(
              tool,
              batch,
              step.options,
              step.format,
              context
            );
      if (!results.length)
        throw new EngineError(
          'CONVERSION_FAILED',
          `${tool.name} produced no file.`
        );
      outputs.push(...results);
    }
    if (index + 1 < steps.length) {
      files = outputs.map(
        (result) =>
          new File([result.blob], result.filename, { type: result.blob.type })
      );
    }
  }
  ctx.signal?.throwIfAborted();
  return outputs;
}
