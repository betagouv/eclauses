import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { LocalFileStore } from '@/server/storage/local';
import { S3FileStore } from '@/server/storage/s3';
import type { FileStore } from '@/server/storage/types';

const read = async (s: ReadableStream<Uint8Array> | null) => (s ? Buffer.from(await new Response(s).arrayBuffer()) : null);

/** Mêmes exigences pour tous les pilotes : changer de stockage ne doit rien changer au métier. */
function contract(name: string, make: () => Promise<{ store: FileStore; cleanup?: () => Promise<void> }>, skip = false) {
  describe.skipIf(skip)(`stockage ${name}`, () => {
    let ctx: Awaited<ReturnType<typeof make>>;
    const prefix = `contrat-${randomUUID().slice(0, 8)}`;
    const key = (n: string) => `${prefix}/${n}`;
    afterAll(async () => {
      await ctx?.cleanup?.();
    });
    const store = async () => (ctx ??= await make()).store;

    it('enregistre puis relit exactement le même contenu', async () => {
      const s = await store();
      const bytes = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 256));
      await s.put(key('a/b/c'), bytes, 'application/octet-stream');
      expect(await s.exists(key('a/b/c'))).toBe(true);
      expect(await read(await s.get(key('a/b/c')))).toEqual(bytes);
    });

    it('une clé absente : exists faux, get nul', async () => {
      const s = await store();
      expect(await s.exists(key('absent'))).toBe(false);
      expect(await s.get(key('absent'))).toBeNull();
    });

    it('écraser une clé remplace le contenu', async () => {
      const s = await store();
      await s.put(key('x'), Buffer.from('un'), 'text/plain');
      await s.put(key('x'), Buffer.from('deux'), 'text/plain');
      expect((await read(await s.get(key('x'))))!.toString()).toBe('deux');
    });

    it('supprime, et supprimer deux fois ne lève pas d’erreur', async () => {
      const s = await store();
      await s.put(key('y'), Buffer.from('y'), 'text/plain');
      await s.delete(key('y'));
      await s.delete(key('y'));
      expect(await s.exists(key('y'))).toBe(false);
    });

    it('un fichier vide est géré', async () => {
      const s = await store();
      await s.put(key('vide'), new Uint8Array(), 'text/plain');
      expect((await read(await s.get(key('vide'))))!.length).toBe(0);
    });
  });
}

contract('local', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'eclauses-fichiers-'));
  return { store: new LocalFileStore(dir), cleanup: () => rm(dir, { recursive: true, force: true }) };
});

contract(
  's3',
  async () => ({
    store: new S3FileStore({
      bucket: process.env.S3_TEST_BUCKET!,
      region: 'us-east-1',
      endpoint: process.env.S3_TEST_ENDPOINT,
      accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY!,
      forcePathStyle: true,
    }),
  }),
  !process.env.S3_TEST_ENDPOINT,
);

describe('stockage local : sécurité', () => {
  it('refuse toute clé qui sort du dossier racine et ne laisse pas de fichier temporaire', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eclauses-fichiers-'));
    const s = new LocalFileStore(dir);
    for (const bad of ['../evasion', 'a/../../evasion', '/etc/passwd']) {
      await expect(s.put(bad, Buffer.from('x'), 'text/plain')).rejects.toThrow();
      await expect(s.get(bad)).rejects.toThrow();
    }
    await s.put('ok/f', Buffer.from('x'), 'text/plain');
    expect(await readdir(join(dir, 'ok'))).toEqual(['f']);
    await rm(dir, { recursive: true, force: true });
  });
});
