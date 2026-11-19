import { API_BASE_URL, apiClient } from './apiClient';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { AppError } from './errorToView';

export async function runServerConversion(
  toolId: string,
  file: File,
  options: Record<string, unknown>,
  context: {
    onProgress: (progress: number) => void;
    signal?: AbortSignal;
  }
): Promise<{ blob: Blob; filename: string; sizeBytes: number }> {
  const { onProgress, signal } = context;

  // 1. Upload via XMLHttpRequest for upload progress tracking
  const jobId = await new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Conversion cancelled'));
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/jobs/convert`);
    xhr.setRequestHeader('Accept', 'application/json');

    const accessCode = useSettingsStore.getState().accessCode;
    if (accessCode) {
      xhr.setRequestHeader('X-Access-Code', accessCode);
    }

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Conversion cancelled'));
      });
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        // Upload phase: 0% -> 30%
        const pct = Math.round((e.loaded / e.total) * 30);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.jobId);
        } catch {
          reject(new Error('Malformed response from server'));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          const appErr: AppError = errData.error ?? {
            code: 'CONVERSION_FAILED',
            message: xhr.statusText,
          };
          reject(appErr);
        } catch {
          reject({
            code: xhr.status === 413 ? 'FILE_TOO_LARGE' : 'CONVERSION_FAILED',
            message: xhr.statusText || 'Upload failed',
          });
        }
      }
    };

    xhr.onerror = () => {
      reject({
        code: 'SERVER_OFFLINE',
        message: 'Could not connect to the conversion server.',
      });
    };

    const formData = new FormData();
    formData.append('toolId', toolId);
    formData.append('options', JSON.stringify(options));
    formData.append('file', file);
    xhr.send(formData);
  });

  // 2. Poll / track job execution (30% -> 95%)
  onProgress(35);
  let finalResult: { filename: string; sizeBytes: number } | null = null;

  while (!signal?.aborted) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (signal?.aborted) {
      // Cancel job on server
      apiClient.cancelJob(jobId).catch(() => {});
      throw new Error('Conversion cancelled');
    }

    const snapshot = await apiClient.getJob(jobId, signal);
    if (snapshot.status === 'succeeded' && snapshot.result) {
      finalResult = {
        filename: snapshot.result.filename,
        sizeBytes: snapshot.result.sizeBytes,
      };
      onProgress(95);
      break;
    } else if (snapshot.status === 'failed') {
      throw snapshot.error ?? { code: 'CONVERSION_FAILED' };
    } else if (snapshot.status === 'cancelled') {
      throw { code: 'JOB_CANCELLED', message: 'Conversion cancelled' };
    } else {
      // Scale progress: 30 + (jobProgress * 0.65)
      const currentScaled = Math.min(
        92,
        Math.max(35, 30 + Math.round(snapshot.progress * 0.65))
      );
      onProgress(currentScaled);
    }
  }

  if (signal?.aborted) {
    apiClient.cancelJob(jobId).catch(() => {});
    throw new Error('Conversion cancelled');
  }

  if (!finalResult) {
    throw new Error('Conversion finished without a result file');
  }

  // 3. Download converted result blob
  const downloadHeaders: Record<string, string> = {};
  const accessCode = useSettingsStore.getState().accessCode;
  if (accessCode) {
    downloadHeaders['X-Access-Code'] = accessCode;
  }

  const downloadRes = await fetch(apiClient.getDownloadUrl(jobId), {
    headers: downloadHeaders,
    signal,
  });

  if (!downloadRes.ok) {
    throw new Error('Failed to download completed conversion result');
  }

  const blob = await downloadRes.blob();
  onProgress(100);

  return {
    blob,
    filename: finalResult.filename,
    sizeBytes: finalResult.sizeBytes,
  };
}
