#!/usr/bin/env node
/**
 * Reprend un fichier du widget Grist (grist/page/<nom> ou grist/composants/<nom>) comme module
 * React de l'application. Le code est conservé tel quel : seuls un en-tête (import de `gristAPI`,
 * hooks) et un export sont ajoutés. Les adaptations (upload, auth, getData ciblé…) se font ensuite
 * à la main. Le script refuse d'écraser un fichier déjà porté, sauf avec --force.
 *
 *   npm run port:page -w apps/web -- beneficiaire-profil
 *   npm run port:page -w apps/web -- ComboBox --component
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [name, ...flags] = process.argv.slice(2);
if (!name) {
  console.error('Usage : port-page <nom> [--component] [--force]');
  process.exit(1);
}
const isComponent = flags.includes('--component');
const source = new URL(`../../../grist/${isComponent ? 'composants' : 'page'}/${name}`, import.meta.url);
const target = new URL(`../src/legacy/${isComponent ? 'components' : 'pages'}/${name}.tsx`, import.meta.url);

if (existsSync(target) && !flags.includes('--force')) {
  console.error(`Déjà porté : ${target.pathname} (--force pour écraser, adaptations perdues)`);
  process.exit(1);
}

let code = readFileSync(source, 'utf8');
const declares = (re) => re.test(code);

const header = [
  `// @ts-nocheck : code repris du widget Grist (grist/${isComponent ? 'composants' : 'page'}/${name}), typé progressivement.`,
  `'use client';`,
  `// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.`,
  `import React from 'react';`,
  `import { gristAPI } from '@/legacy/gristAPI';`,
  declares(/\bconst\s+\{[^}]*useState/) ? '' : `const { useState, useEffect, useMemo, useCallback } = React;`,
  declares(/\bconst\s+helpers\b/) ? '' : `const helpers = gristAPI.helpers;`,
  '',
].filter((l, i, a) => l !== '' || i === a.length - 1);

if (/module\.exports\s*=\s*(\w+);?/.test(code)) {
  code = code.replace(/module\.exports\s*=\s*(\w+);?/, 'export default $1;');
} else {
  code = `${code.trimEnd()}\n\nexport default Component;\n`;
}

writeFileSync(target, `${header.join('\n')}\n${code}`);
console.log(`Porté : ${target.pathname}`);
