import { z } from 'zod';
import { GristClient } from './grist/client';

const schema = z.object({
  GRIST_BASE_URL: z.string().url().default('https://grist.numerique.gouv.fr'),
  GRIST_DOC_ID: z.string().min(10),
  GRIST_API_KEY: z.string().min(20),
  SESSION_SECRET: z.string().min(32),
  CV_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
});

export type Config = z.infer<typeof schema>;

let cached: Config | undefined;

export function config(): Config {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
      throw new Error(`Configuration invalide ou incomplète : ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}

let client: GristClient | undefined;

/** Client Grist unique, avec la clé de service du serveur. */
export function grist(): GristClient {
  if (!client) {
    const c = config();
    client = new GristClient({ baseUrl: c.GRIST_BASE_URL, docId: c.GRIST_DOC_ID, apiKey: c.GRIST_API_KEY });
  }
  return client;
}
