import { describe, it, expect } from 'vitest';
import { dataEngine, getPreviewRows } from '@/features/engines/dataEngine';

describe('Data Engine', () => {
  it('converts CSV to JSON', async () => {
    const csvContent = 'name,age,city\nAlice,30,New York\nBob,25,San Francisco';
    const file = new File([csvContent], 'users.csv', { type: 'text/csv' });

    let progressRecorded = 0;
    const results = await dataEngine.run([file], {}, 'json', {
      onProgress: (p) => {
        progressRecorded = p;
      },
    });

    expect(results.length).toBe(1);
    const res = results[0];
    expect(res).toBeDefined();
    if (!res) return;
    expect(res.filename).toBe('users.json');
    expect(res.mime).toBe('application/json');
    expect(progressRecorded).toBe(100);

    const jsonText = await res.blob.text();
    const data = JSON.parse(jsonText);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0].name).toBe('Alice');
    expect(data[0].age).toBe(30);
  });

  it('converts JSON to CSV with custom delimiter', async () => {
    const jsonContent = JSON.stringify([
      { sku: 'A100', price: 29.99 },
      { sku: 'B200', price: 49.99 },
    ]);
    const file = new File([jsonContent], 'products.json', { type: 'application/json' });

    const results = await dataEngine.run([file], { delimiter: ';' }, 'csv', {
      onProgress: () => {},
    });

    expect(results.length).toBe(1);
    const res = results[0];
    expect(res).toBeDefined();
    if (!res) return;
    expect(res.filename).toBe('products.csv');
    const text = await res.blob.text();
    expect(text).toContain('sku;price');
    expect(text).toContain('A100;29.99');
  });

  it('converts CSV to XLSX binary', async () => {
    const csvContent = 'col1,col2\n10,20';
    const file = new File([csvContent], 'data.csv', { type: 'text/csv' });

    const results = await dataEngine.run([file], {}, 'xlsx', {
      onProgress: () => {},
    });

    expect(results.length).toBe(1);
    const res = results[0];
    expect(res).toBeDefined();
    if (!res) return;
    expect(res.filename).toBe('data.xlsx');
    expect(res.sizeBytes).toBeGreaterThan(0);
  });

  it('provides preview of first 5 rows with headers', async () => {
    const rows = ['id,name,val'];
    for (let i = 1; i <= 10; i++) {
      rows.push(`${i},Item${i},${i * 100}`);
    }
    const file = new File([rows.join('\n')], 'items.csv', { type: 'text/csv' });

    const preview = await getPreviewRows(file);
    expect(preview.headers).toEqual(['id', 'name', 'val']);
    expect(preview.rows.length).toBe(5);
    expect(preview.totalRows).toBe(10);
    expect(preview.rows[0]?.[1]).toBe('Item1');
  });

  it('throws FILE_CORRUPT on malformed JSON data', async () => {
    const file = new File(['not valid json {['], 'bad.json', { type: 'application/json' });

    await expect(
      dataEngine.run([file], {}, 'csv', { onProgress: () => {} })
    ).rejects.toThrow();
  });
});
