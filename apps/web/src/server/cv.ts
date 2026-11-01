export type CvKind = 'pdf' | 'doc' | 'docx';

export interface CvCheck {
  ok: boolean;
  reason?: string;
  kind?: CvKind;
  mime?: string;
  fileName?: string;
}

const MIME: Record<CvKind, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

/** Nom de fichier sûr : pas de chemin, pas de caractère de contrôle, longueur bornée. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'cv';
  const cleaned = base.replace(/[\u0000-\u001f"<>|:*?]/g, '').trim();
  return (cleaned || 'cv').slice(-120);
}

/**
 * Le type est déterminé par le contenu du fichier, pas par le type annoncé par le navigateur
 * (qui est librement modifiable).
 */
export function checkCv(bytes: Uint8Array, name: string, maxBytes: number): CvCheck {
  if (bytes.byteLength === 0) return { ok: false, reason: 'Fichier vide.' };
  if (bytes.byteLength > maxBytes) {
    return { ok: false, reason: `Fichier trop volumineux (max ${Math.round(maxBytes / 1024 / 1024)} Mo).` };
  }
  const fileName = safeFileName(name);
  const lower = fileName.toLowerCase();

  let kind: CvKind | undefined;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]) && lower.endsWith('.pdf')) kind = 'pdf';
  else if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) && lower.endsWith('.doc')) kind = 'doc';
  else if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && lower.endsWith('.docx')) {
    // Un .docx est une archive ZIP qui contient un dossier `word/`.
    const head = Buffer.from(bytes.subarray(0, Math.min(bytes.byteLength, 65536))).toString('latin1');
    if (head.includes('word/')) kind = 'docx';
  }

  if (!kind) return { ok: false, reason: 'Type de fichier non autorisé (PDF, DOC ou DOCX attendus).' };
  return { ok: true, kind, mime: MIME[kind], fileName };
}
