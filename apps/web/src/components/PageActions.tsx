'use client';

import type { ReactNode } from 'react';

/** Petits comportements navigateur des pages rendues par le serveur (impression, retour en haut de page). */
export function PrintButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {children}
    </button>
  );
}

export function BackToTop({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <a
      className={className}
      href="#top"
      onClick={(e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      {children}
    </a>
  );
}
