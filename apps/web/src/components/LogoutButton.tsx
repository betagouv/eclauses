'use client';

export function LogoutButton({ className }: { className?: string }) {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }
  return (
    <button type="button" className={className ?? 'fr-btn fr-icon-logout-box-r-line'} onClick={logout}>
      Se déconnecter
    </button>
  );
}
