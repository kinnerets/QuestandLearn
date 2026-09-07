'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MenuIcon, CloseIcon, UsersIcon, LockIcon } from './icons';
import { DisplaySettings } from './DisplaySettings';

/** A slide-in side menu: switch child, enter the parent area, and set display
 *  preferences (theme + text size) in one place. Triggered from the home hero. */
export function SideMenu({ canSwitch, floating = false }: { canSwitch: boolean; floating?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button className={`menu-btn${floating ? ' floating' : ''}`} aria-label="תפריט" onClick={() => setOpen(true)}>
        <MenuIcon />
      </button>

      {open && <div className="drawer-scrim" onClick={close} />}

      <aside className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <span className="drawer-title">תפריט</span>
          <button className="drawer-close" aria-label="סגירה" onClick={close}><CloseIcon /></button>
        </div>

        <nav className="drawer-nav">
          {canSwitch && (
            <Link href="/profiles" className="drawer-link" onClick={close}>
              <UsersIcon /> החלפת משתמש
            </Link>
          )}
          <Link href="/parent" className="drawer-link" onClick={close}>
            <LockIcon /> אזור הורים
          </Link>
        </nav>

        <DisplaySettings />
      </aside>
    </>
  );
}
