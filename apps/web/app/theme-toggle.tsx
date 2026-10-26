'use client';

// Light/dark switch. layout.tsx's inline script sets <html data-theme> before paint (saved choice, else the device
// setting); this button flips it and remembers the choice on this device. CSS shows the matching icon.
export function ThemeToggle({ corner = false }: { corner?: boolean }) {
  return (
    <button
      type="button"
      className={`theme-toggle${corner ? ' corner' : ''}`}
      aria-label="Switch between light and dark"
      title="Light / dark"
      onClick={() => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('theme', next);
        } catch {
          /* storage blocked: the choice lasts until the page reloads */
        }
      }}
    >
      <svg
        className="t-sun"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg
        className="t-moon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
