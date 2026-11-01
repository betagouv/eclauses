import { describe, expect, it } from 'vitest';
import { checkCv, safeFileName } from '@/server/cv';

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const doc = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
const zipWithWord = new Uint8Array(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('....word/document.xml')]));
const zipWithoutWord = new Uint8Array(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('....autre/chose.xml')]));
const MAX = 5 * 1024 * 1024;

describe('checkCv', () => {
  it('accepte un PDF, un DOC et un DOCX réels', () => {
    expect(checkCv(pdf, 'cv.pdf', MAX)).toMatchObject({ ok: true, kind: 'pdf' });
    expect(checkCv(doc, 'cv.doc', MAX)).toMatchObject({ ok: true, kind: 'doc' });
    expect(checkCv(zipWithWord, 'cv.docx', MAX)).toMatchObject({ ok: true, kind: 'docx' });
  });

  it('refuse un exécutable renommé en PDF', () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    expect(checkCv(exe, 'cv.pdf', MAX).ok).toBe(false);
  });

  it('refuse un ZIP quelconque renommé en .docx', () => {
    expect(checkCv(zipWithoutWord, 'cv.docx', MAX).ok).toBe(false);
  });

  it('refuse une extension qui ne correspond pas au contenu', () => {
    expect(checkCv(pdf, 'cv.docx', MAX).ok).toBe(false);
  });

  it('refuse un fichier vide ou trop gros', () => {
    expect(checkCv(new Uint8Array(0), 'cv.pdf', MAX).ok).toBe(false);
    expect(checkCv(pdf, 'cv.pdf', 4).ok).toBe(false);
  });
});

describe('safeFileName', () => {
  it('retire les chemins et caractères dangereux', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\moi\\cv:final?.pdf')).toBe('cvfinal.pdf');
    expect(safeFileName('')).toBe('cv');
  });
});

describe('multipartFile', () => {
  it('termine le corps par une frontière suivie d’un saut de ligne', async () => {
    const { multipartFile } = await import('@/server/grist/client');
    const { body, contentType } = await multipartFile('upload', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'a "b".pdf');
    const text = Buffer.from(body).toString('latin1');
    const boundary = /boundary=(.+)$/.exec(contentType)![1]!;
    expect(text.endsWith(`\r\n--${boundary}--\r\n`)).toBe(true);
    expect(text).toContain('name="upload"; filename="a _b_.pdf"');
    expect(text).toContain('Content-Type: application/pdf');
  });
});
