// Module serveur uniquement : ne jamais l'importer depuis un composant client.

export interface GristConfig {
  baseUrl: string;
  docId: string;
  apiKey: string;
}

export class GristError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'GristError';
  }
}

/** Ligne à plat, comme `gristAPI.getData` dans le widget : `{ id, ...champs }`. */
export type Row = { id: number } & Record<string, unknown>;

/** Filtre de l'API records : chaque colonne accepte une liste de valeurs. */
export type Filter = Record<string, readonly (string | number | boolean)[]>;

const RETRYABLE = new Set([429, 502, 503, 504]);

/**
 * Corps multipart construit à la main. Le `FormData` de Node (undici) omet le saut de ligne qui doit
 * suivre la dernière frontière ; le serveur d'upload de Grist répond alors 500, alors que curl, qui
 * l'ajoute, passe. On reste donc strictement conforme au format.
 */
export async function multipartFile(
  field: string,
  file: Blob,
  filename: string,
): Promise<{ body: Uint8Array; contentType: string }> {
  const boundary = `----eclauses${crypto.randomUUID().replaceAll('-', '')}`;
  const safeName = filename.replace(/["\r\n]/g, '_');
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${safeName}"\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(head), Buffer.from(await file.arrayBuffer()), Buffer.from(tail)]);
  return { body: new Uint8Array(body), contentType: `multipart/form-data; boundary=${boundary}` };
}

export class GristClient {
  constructor(private readonly cfg: GristConfig) {}

  private docUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`/api/docs/${this.cfg.docId}${path}`, this.cfg.baseUrl);
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
    return url.toString();
  }

  private async request(
    method: string,
    url: string,
    init: { json?: unknown; multipart?: { body: Uint8Array; contentType: string }; raw?: boolean } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.cfg.apiKey}` };
    let body: BodyInit | undefined;
    if (init.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.json);
    } else if (init.multipart) {
      // Grist exige cet en-tête pour accepter l'upload de pièces jointes.
      headers['X-Requested-With'] = 'XMLHttpRequest';
      headers['Content-Type'] = init.multipart.contentType;
      body = init.multipart.body as BodyInit;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(20_000) });
        if (RETRYABLE.has(res.status) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
          continue;
        }
        if (!res.ok && !init.raw) {
          const payload = await res.json().catch(() => undefined);
          throw new GristError(`Grist ${method} ${new URL(url).pathname} : ${res.status}`, res.status, payload);
        }
        return res;
      } catch (e) {
        lastError = e;
        if (e instanceof GristError) throw e;
        if (attempt === 2) break;
        await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Appel Grist en échec');
  }

  /** Lecture de lignes, avec filtre côté serveur Grist. */
  async records(table: string, opts: { filter?: Filter; limit?: number } = {}): Promise<Row[]> {
    const params: Record<string, string> = {};
    if (opts.filter) params.filter = JSON.stringify(opts.filter);
    if (opts.limit) params.limit = String(opts.limit);
    const res = await this.request('GET', this.docUrl(`/tables/${table}/records`, params));
    const data = (await res.json()) as { records: { id: number; fields: Record<string, unknown> }[] };
    return data.records.map((r) => ({ id: r.id, ...r.fields }));
  }

  /** Requête SQL en lecture seule (nécessite une clé propriétaire). */
  async sql<T = Record<string, unknown>>(sql: string, args: readonly unknown[] = []): Promise<T[]> {
    const res = await this.request('POST', this.docUrl('/sql'), { json: { sql, args } });
    const data = (await res.json()) as { records: { fields: T }[] };
    return data.records.map((r) => r.fields);
  }

  async addRecords(table: string, rows: Record<string, unknown>[]): Promise<number[]> {
    const res = await this.request('POST', this.docUrl(`/tables/${table}/records`), {
      json: { records: rows.map((fields) => ({ fields })) },
    });
    const data = (await res.json()) as { records: { id: number }[] };
    return data.records.map((r) => r.id);
  }

  async updateRecords(table: string, rows: { id: number; fields: Record<string, unknown> }[]): Promise<void> {
    await this.request('PATCH', this.docUrl(`/tables/${table}/records`), { json: { records: rows } });
  }

  async deleteRecords(table: string, ids: number[]): Promise<void> {
    await this.request('POST', this.docUrl(`/tables/${table}/data/delete`), { json: ids });
  }

  async uploadAttachment(file: Blob, filename: string): Promise<number> {
    const res = await this.request('POST', this.docUrl('/attachments'), {
      multipart: await multipartFile('upload', file, filename),
    });
    const ids = (await res.json()) as number[];
    if (!Array.isArray(ids) || !Number.isInteger(ids[0])) {
      throw new GristError("Grist n'a pas renvoyé d'identifiant de pièce jointe", 502, ids);
    }
    return ids[0];
  }

  async attachmentMeta(id: number): Promise<{ fileName: string; fileSize: number; timeUploaded: string }> {
    const res = await this.request('GET', this.docUrl(`/attachments/${id}`));
    return (await res.json()) as { fileName: string; fileSize: number; timeUploaded: string };
  }

  /** Flux brut de la pièce jointe (à relayer au navigateur après contrôle des droits). */
  async downloadAttachment(id: number): Promise<Response> {
    return this.request('GET', this.docUrl(`/attachments/${id}/download`));
  }

  async tables(): Promise<string[]> {
    const res = await this.request('GET', this.docUrl('/tables'));
    const data = (await res.json()) as { tables: { id: string }[] };
    return data.tables.map((t) => t.id);
  }

  async columns(table: string): Promise<{ id: string; type: string; isFormula: boolean }[]> {
    const res = await this.request('GET', this.docUrl(`/tables/${table}/columns`));
    const data = (await res.json()) as {
      columns: { id: string; fields: { type: string; isFormula: boolean } }[];
    };
    return data.columns.map((c) => ({ id: c.id, type: c.fields.type, isFormula: c.fields.isFormula }));
  }
}
