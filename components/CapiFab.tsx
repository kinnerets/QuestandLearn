'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Capi } from './Capi';

// Screens where a floating button would get in the way (immersive / already-Capi).
const HIDE = ['/capi', '/parent', '/profiles', '/placement', '/avatar', '/exercise'];
const SIZE = 58;
const POS_KEY = 'ql_capi_pos';

/** A small, still Capi that floats on every relaxed screen and opens the chat.
 *  Draggable: press and drag to move it out of the way; a tap (no drag) opens
 *  the chat. Its position is remembered per device. */
export function CapiFab() {
  const path = usePathname() || '/';
  const router = useRouter();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const drag = useRef({ active: false, moved: false, dx: 0, dy: 0, sx: 0, sy: 0 });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.left === 'number' && typeof p?.top === 'number') setPos(clamp(p.left, p.top));
      }
    } catch { /* ignore */ }
  }, []);

  function clamp(left: number, top: number) {
    const w = typeof window !== 'undefined' ? window.innerWidth : 400;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    return {
      left: Math.max(8, Math.min(left, w - SIZE - 8)),
      top: Math.max(8, Math.min(top, h - SIZE - 8)),
    };
  }

  if (HIDE.some((p) => path === p || path.startsWith(p + '/'))) return null;

  function onPointerDown(e: React.PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    drag.current = { active: true, moved: false, dx: e.clientX - rect.left, dy: e.clientY - rect.top, sx: e.clientX, sy: e.clientY };
    el.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    // Ignore tiny jitter so a tap still registers as a tap, not a drag.
    if (!drag.current.moved && Math.abs(e.clientX - drag.current.sx) + Math.abs(e.clientY - drag.current.sy) < 6) return;
    drag.current.moved = true;
    setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
  }
  function onPointerUp(e: React.PointerEvent) {
    const wasDrag = drag.current.moved;
    drag.current.active = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (wasDrag) {
      setPos((p) => { if (p) { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* ignore */ } } return p; });
    } else {
      router.push('/capi');
    }
  }

  const style: React.CSSProperties = pos
    ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto', touchAction: 'none' }
    : { touchAction: 'none' };

  return (
    <button
      className="capi-fab" aria-label="שאלי את קפי (אפשר לגרור)" style={style}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
    >
      <Capi mood="chill" size={42} still />
    </button>
  );
}
