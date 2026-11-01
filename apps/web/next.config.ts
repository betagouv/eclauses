import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // En standalone dans un monorepo, Next doit tracer depuis la racine du dépôt.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
};

export default config;
