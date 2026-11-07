export const DOCUMENT_MAX_BYTES = 10_485_760;
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png';

async function header(file: File): Promise<Uint8Array> {
  const blob = file.slice(0, 8);
  const buffer = typeof blob.arrayBuffer === 'function' ? await blob.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Document could not be read.'));
    reader.readAsArrayBuffer(blob);
  });
  return new Uint8Array(buffer);
}

export async function validateInsuranceDocuments(files: File[], arabic = false): Promise<void> {
  const message = arabic
    ? 'اختر ملف PDF أو JPEG أو PNG غير فارغ بحد أقصى 10 MiB (10,485,760 بايت). يجب أن يطابق محتوى الملف امتداده.'
    : 'Choose a non-empty PDF, JPEG or PNG file up to 10 MiB (10,485,760 bytes). File content must match its extension.';
  if (!files.length) throw new Error(message);
  for (const file of files) {
    if (file.size <= 0 || file.size > DOCUMENT_MAX_BYTES) throw new Error(message);
    const extension = file.name.split('.').at(-1)?.toLowerCase();
    const bytes = await header(file);
    const pdf = extension === 'pdf' && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
    const jpeg = (extension === 'jpg' || extension === 'jpeg') && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = extension === 'png' && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
    if (!pdf && !jpeg && !png) throw new Error(message);
  }
}
