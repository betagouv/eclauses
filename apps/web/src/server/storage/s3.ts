import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { FileStore } from './types';

export interface S3Options {
  bucket: string;
  region: string;
  /** Point d'accès S3 compatible (Scaleway Object Storage, MinIO…) ; absent pour AWS. */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Requis par MinIO ; Scaleway accepte les deux styles. */
  forcePathStyle?: boolean;
}

/** Stockage objet compatible S3 : mêmes clés opaques que le pilote local. */
export class S3FileStore implements FileStore {
  private readonly client: S3Client;

  constructor(private readonly opts: S3Options) {
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint,
      forcePathStyle: opts.forcePathStyle,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }

  async put(cle: string, contenu: Uint8Array, typeMime: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.opts.bucket, Key: cle, Body: contenu, ContentType: typeMime }));
  }

  async get(cle: string): Promise<ReadableStream<Uint8Array> | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: cle }));
      return (res.Body?.transformToWebStream() as ReadableStream<Uint8Array> | undefined) ?? null;
    } catch (e) {
      if (isMissing(e)) return null;
      throw e;
    }
  }

  async delete(cle: string): Promise<void> {
    // S3 répond 204 même si l'objet n'existe pas : la suppression est idempotente.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: cle }));
  }

  async exists(cle: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.opts.bucket, Key: cle }));
      return true;
    } catch (e) {
      if (isMissing(e)) return false;
      throw e;
    }
  }
}

function isMissing(e: unknown): boolean {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
  return err.name === 'NoSuchKey' || err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404;
}
