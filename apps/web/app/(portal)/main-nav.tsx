'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NavLink } from '../nav-link';

// Main navigation. With many links (staff), phones get a menu button that opens a panel; on wider screens and
// for students (4 links fit in a row) the links are always shown.
export function MainNav({ items }: { items: string[][] }) {
  const collapsible = items.length > 5;
  const path = usePathname();
  // Remember the page the menu was opened on: navigating elsewhere closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (v: boolean) => setOpenOn(v ? path : null);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpenOn(null);
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  return (
    <>
      {collapsible && (
        <button
          type="button"
          className="burger"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen(!open)}
        >
          <span aria-hidden="true" />
          <span className="sr-only">Menu</span>
        </button>
      )}
      <nav
        id="main-nav"
        className="nav"
        aria-label="Main"
        data-collapsible={collapsible || undefined}
        data-open={open || undefined}
      >
        {items.map(([href, label]) => (
          <NavLink key={href} href={href!}>
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
