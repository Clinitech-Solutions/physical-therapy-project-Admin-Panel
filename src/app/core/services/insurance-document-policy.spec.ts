import { describe, it, expect } from 'vitest';
import { DOCUMENT_MAX_BYTES, validateInsuranceDocuments } from './insurance-document-policy';

describe('Patient document upload policy', () => {
  it('accepts supported content and extensions independently of supplied MIME', async () => {
    await expect(validateInsuranceDocuments([
      new File(['%PDF-1.7\nSynthetic'], 'UAT.pdf', { type: 'text/plain' }),
      new File([new Uint8Array([255,216,255,224,0,0,0,0])], 'UAT.JPEG'),
      new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'UAT.png'),
    ])).resolves.toBeUndefined();
  });
  it('allows exactly 10 MiB and rejects one additional byte', async () => {
    const bytes = new Uint8Array(DOCUMENT_MAX_BYTES); bytes.set(new TextEncoder().encode('%PDF-1.7'));
    await expect(validateInsuranceDocuments([new File([bytes], 'boundary.pdf')])).resolves.toBeUndefined();
    await expect(validateInsuranceDocuments([new File([bytes, new Uint8Array([0])], 'too-large.pdf')])).rejects.toThrow('10 MiB');
  });
  it('rejects empty, unsupported and misleading files without sending them', async () => {
    for (const file of [new File([], 'empty.pdf'), new File(['%PDF-1.7'], 'unsupported.exe'), new File(['not a PDF'], 'misleading.pdf'), new File(['%PDF-1.7'], 'misleading.png')]) {
      await expect(validateInsuranceDocuments([file])).rejects.toThrow('File content must match');
    }
  });
  it('provides Arabic validation feedback', async () => {
    await expect(validateInsuranceDocuments([new File([], 'empty.pdf')], true)).rejects.toThrow('غير فارغ');
  });
});
