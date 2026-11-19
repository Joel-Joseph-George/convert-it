import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runServerConversion } from '../src/features/server/serverConversion';
import { apiClient } from '../src/features/server/apiClient';

interface MockXHRContext {
  upload?: { onprogress?: ((e: ProgressEvent) => void) | null };
  onload?: (() => void) | null;
  onerror?: (() => void) | null;
  status: number;
  responseText: string;
}

describe('runServerConversion', () => {
  const origXHR = window.XMLHttpRequest;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.XMLHttpRequest = origXHR;
  });

  it('handles successful upload, status polling, and result download', async () => {
    const mockFile = new File(['test content'], 'sample.pdf', {
      type: 'application/pdf',
    });
    const progressCalls: number[] = [];

    // Mock XMLHttpRequest for upload
    const mockXHR = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(function (this: MockXHRContext) {
        // Trigger upload progress
        if (this.upload?.onprogress) {
          this.upload.onprogress({
            lengthComputable: true,
            loaded: 50,
            total: 100,
          } as ProgressEvent);
        }
        // Trigger load success
        this.status = 202;
        this.responseText = JSON.stringify({ jobId: 'test-job-123' });
        if (this.onload) {
          this.onload();
        }
      }),
      upload: { onprogress: null as ((e: ProgressEvent) => void) | null },
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      status: 202,
      responseText: '',
    };

    window.XMLHttpRequest = vi.fn(() => mockXHR) as unknown as typeof XMLHttpRequest;

    // Mock apiClient.getJob
    vi.spyOn(apiClient, 'getJob').mockResolvedValueOnce({
      id: 'test-job-123',
      type: 'convert',
      toolId: 'pdf-to-word',
      status: 'succeeded',
      stage: 'finalizing',
      progress: 100,
      queuePosition: 0,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      error: null,
      result: {
        filename: 'sample.docx',
        sizeBytes: 1234,
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        expiresAt: new Date().toISOString(),
      },
    });

    // Mock fetch for download
    const mockBlob = new Blob(['converted-docx'], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    }) as unknown as typeof fetch;

    const result = await runServerConversion(
      'pdf-to-word',
      mockFile,
      {},
      {
        onProgress: (p) => progressCalls.push(p),
      }
    );

    expect(result.filename).toBe('sample.docx');
    expect(result.sizeBytes).toBe(1234);
    expect(result.blob).toBe(mockBlob);
    expect(progressCalls).toContain(15); // Upload progress 50/100 * 30%
    expect(progressCalls).toContain(100);
  });

  it('rejects with error when server job fails', async () => {
    const mockFile = new File(['text without tables'], 'plain.pdf', {
      type: 'application/pdf',
    });

    const mockXHR = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(function (this: MockXHRContext) {
        this.status = 202;
        this.responseText = JSON.stringify({ jobId: 'failed-job-999' });
        if (this.onload) {
          this.onload();
        }
      }),
      upload: { onprogress: null as ((e: ProgressEvent) => void) | null },
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      status: 202,
      responseText: '',
    };

    window.XMLHttpRequest = vi.fn(() => mockXHR) as unknown as typeof XMLHttpRequest;

    vi.spyOn(apiClient, 'getJob').mockResolvedValueOnce({
      id: 'failed-job-999',
      type: 'convert',
      toolId: 'pdf-to-excel',
      status: 'failed',
      stage: 'converting',
      progress: 50,
      queuePosition: 0,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      result: null,
      error: {
        code: 'NO_TABLES_FOUND',
        message: 'No tables found. Scanned PDFs may need OCR.',
      },
    });

    await expect(
      runServerConversion(
        'pdf-to-excel',
        mockFile,
        {},
        {
          onProgress: vi.fn(),
        }
      )
    ).rejects.toEqual({
      code: 'NO_TABLES_FOUND',
      message: 'No tables found. Scanned PDFs may need OCR.',
    });
  });

  it('cancels job when signal is aborted', async () => {
    const mockFile = new File(['cancel me'], 'cancel.pdf', {
      type: 'application/pdf',
    });
    const controller = new AbortController();

    const mockXHR = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      abort: vi.fn(),
      send: vi.fn(function (this: MockXHRContext) {
        this.status = 202;
        this.responseText = JSON.stringify({ jobId: 'cancel-job-111' });
        if (this.onload) {
          this.onload();
        }
      }),
      upload: { onprogress: null as ((e: ProgressEvent) => void) | null },
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      status: 202,
      responseText: '',
    };

    window.XMLHttpRequest = vi.fn(() => mockXHR) as unknown as typeof XMLHttpRequest;

    const cancelSpy = vi
      .spyOn(apiClient, 'cancelJob')
      .mockResolvedValueOnce({ status: 'cancelled' });

    // Abort after upload
    vi.spyOn(apiClient, 'getJob').mockImplementation(async () => {
      controller.abort();
      return {
        id: 'cancel-job-111',
        type: 'convert',
        toolId: 'pdf-to-word',
        status: 'running',
        stage: 'converting',
        progress: 40,
        queuePosition: 0,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: null,
        error: null,
        result: null,
      };
    });

    await expect(
      runServerConversion(
        'pdf-to-word',
        mockFile,
        {},
        {
          onProgress: vi.fn(),
          signal: controller.signal,
        }
      )
    ).rejects.toThrow('Conversion cancelled');

    expect(cancelSpy).toHaveBeenCalledWith('cancel-job-111');
  });
});
