import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

describe('sécurité : adresse IP, taille des corps, HTML éditable', () => {
  it('clientIp ignore les entrées forgées par le client et retient celle ajoutée par le proxy de confiance', async () => {
    const { clientIp } = await import('@/server/http');
    const req = (xff?: string) => new Request('http://x', { headers: xff ? { 'x-forwarded-for': xff } : {} });
    delete process.env.TRUSTED_PROXIES;
    expect(clientIp(req('6.6.6.6, 203.0.113.9'))).toBe('203.0.113.9');
    expect(clientIp(req('203.0.113.9'))).toBe('203.0.113.9');
    expect(clientIp(req())).toBe('local');
    process.env.TRUSTED_PROXIES = '2';
    expect(clientIp(req('6.6.6.6, 203.0.113.9, 10.0.0.1'))).toBe('203.0.113.9');
    delete process.env.TRUSTED_PROXIES;
  });

  it('formDataLimite refuse un corps sans taille annoncée ou trop gros', async () => {
    const { formDataLimite } = await import('@/server/http');
    const rejette = async (headers: Record<string, string>) => {
      try {
        await formDataLimite(new Request('http://x', { method: 'POST', body: 'a=1', headers }), 100);
      } catch (e) {
        return (e as { status: number }).status;
      }
      return 0;
    };
    expect(await rejette({ 'content-length': '5000' })).toBe(413);
    expect(await rejette({ 'content-length': 'abc' })).toBe(411);
    const form = new FormData();
    form.set('a', '1');
    const ok = await formDataLimite(new Request('http://x', { method: 'POST', body: form, headers: { 'content-length': '50' } }), 100).catch(() => null);
    expect(ok === null || ok.get('a') === '1').toBe(true);
  });

  it('assainirHtml ne garde que la mise en forme simple', async () => {
    const { assainirHtml } = await import('@/server/site');
    expect(assainirHtml('Ministère<br>de la <b>Culture</b>')).toBe('Ministère<br>de la <b>Culture</b>');
    expect(assainirHtml('<script>alert(1)</script>ok')).toBe('alert(1)ok');
    expect(assainirHtml('<img src=x onerror=alert(1)>texte')).toBe('texte');
    expect(assainirHtml('<span onclick="x()">a</span>')).toBe('<span>a</span>');
    expect(assainirHtml('<a href="javascript:alert(1)">l</a>')).toBe('<a>l</a>');
    expect(assainirHtml('<a href="https://culture.gouv.fr" onclick="x()">l</a>')).toBe('<a href="https://culture.gouv.fr" rel="noreferrer">l</a>');
    expect(assainirHtml('a < b > c')).toBe('a &lt; b &gt; c');
  });
});
