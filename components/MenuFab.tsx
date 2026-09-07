'use client';

import { usePathname } from 'next/navigation';
import { SideMenu } from './SideMenu';

// Home has its own menu in the hero; immersive/dedicated screens don't need a
// floating one. Everywhere else, a small fixed hamburger opens the same drawer.
const HIDE = ['/', '/exercise', '/capi', '/parent', '/profiles', '/placement', '/avatar', '/onboarding'];

/** A floating menu button on the browsing screens, so the menu (switch child,
 *  parent area, display settings) is reachable from any page - not only home. */
export function MenuFab() {
  const path = usePathname() || '/';
  if (HIDE.some((p) => path === p || (p !== '/' && path.startsWith(p + '/')))) return null;
  return <SideMenu canSwitch floating />;
}
