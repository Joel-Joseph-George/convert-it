import { describe, it, expect } from 'vitest';
import { createZipArchive } from '@/features/engines/zipUtil';

describe('Zip Utility (fflate)', () => {
  it('creates valid ZIP archive from multiple file entries', async () => {
    const entries = [
      { name: 'test1.txt', data: 'Hello World 1' },
      { name: 'test2.txt', data: 'Hello World 2' },
    ];

    const zipBlob = await createZipArchive(entries);
    expect(zipBlob.type).toBe('application/zip');
    expect(zipBlob.size).toBeGreaterThan(0);
  });
});
