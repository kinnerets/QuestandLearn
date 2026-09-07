'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { CloseIcon, CheckIcon, LockIcon, CoinIcon } from '@/components/icons';
import { miliAvatar } from '@/lib/mockData';
import type { AvatarConfig } from '@/lib/types';

interface ShopItem { id: string; value: string; cost: number; owned: boolean }

const SKIN = ['#FCE0C8', '#F1C9A5', '#E8B98F', '#C68642', '#8D5524'];
const HAIR = ['#1F1B18', '#3B2A1E', '#7A4B2B', '#B5651D', '#E4A11B', '#C0C0C0'];
const TOP = ['#FF2A85', '#38BDF8', '#2FBF8F', '#FACC15', '#8B5CF6', '#F97316'];

// `premium` options are locked until bought in the shop (value must match the
// avatar_items svg_layer.value seeded in the DB).
const HAIRSTYLES: OptDef<string>[] = [
  { id: 'long', label: 'ארוך' },
  { id: 'short', label: 'קצר' },
  { id: 'ponytail', label: 'קוקו', premium: true },
];
const ACCESSORIES: OptDef<string | null>[] = [
  { id: null, label: 'ללא' },
  { id: 'bow', label: 'סרט' },
  { id: 'glasses', label: 'משקפיים' },
  { id: 'flower', label: 'פרח', premium: true },
  { id: 'headphones', label: 'אוזניות', premium: true },
  { id: 'crown', label: 'כתר', premium: true },
  { id: 'star', label: 'כוכב', premium: true },
  { id: 'earrings', label: 'עגילים', premium: true },
  { id: 'sunglasses', label: 'משקפי שמש', premium: true },
];
const BASES = [
  { id: 'girl', label: 'ילדה' },
  { id: 'boy', label: 'ילד' },
];

type OptDef<T> = { id: T; label: string; premium?: boolean };
type Status = 'idle' | 'saving' | 'saved' | 'error';

export default function AvatarPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<AvatarConfig>(miliAvatar);
  const [status, setStatus] = useState<Status>('idle');
  const [shop, setShop] = useState<ShopItem[]>([]);
  const [coins, setCoins] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);
  const [note, setNote] = useState<string>('');

  function loadShop() {
    fetch('/api/avatar/shop')
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.items)) setShop(j.items as ShopItem[]);
        if (typeof j?.coins === 'number') setCoins(j.coins);
      })
      .catch(() => {});
  }

  useEffect(() => {
    let alive = true;
    fetch('/api/profile')
      .then((r) => r.json())
      .then((j) => { if (alive && j?.child?.avatar) setCfg(j.child.avatar as AvatarConfig); })
      .catch(() => {});
    loadShop();
    return () => { alive = false; };
  }, []);

  // value → shop item, and the set of owned values (for gating the chips).
  const shopByValue = useMemo(() => new Map(shop.map((s) => [s.value, s])), [shop]);
  const owned = useMemo(() => new Set(shop.filter((s) => s.owned).map((s) => s.value)), [shop]);

  async function buy(value: string) {
    const item = shopByValue.get(value);
    if (!item || item.owned || buying) return;
    if (coins < item.cost) { setNote(`צריך עוד ${item.cost - coins} מטבעות בשביל זה`); return; }
    setBuying(value); setNote('');
    try {
      const r = await fetch('/api/avatar/buy', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const j = await r.json();
      if (j?.ok) {
        if (typeof j.coins === 'number') setCoins(j.coins);
        setShop((xs) => xs.map((s) => (s.value === value ? { ...s, owned: true } : s)));
      } else if (j?.reason === 'not-enough') {
        setNote('אין מספיק מטבעות עדיין');
      }
    } catch { /* ignore */ }
    setBuying(null);
  }

  const set = (patch: Partial<AvatarConfig>) => { setCfg((c) => ({ ...c, ...patch })); setStatus('idle'); };

  async function save() {
    setStatus('saving');
    try {
      const r = await fetch('/api/avatar', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config: cfg }),
      });
      const j = await r.json();
      if (j?.ok) { setStatus('saved'); router.refresh(); setTimeout(() => router.push('/'), 650); }
      else setStatus('error');
    } catch { setStatus('error'); }
  }

  return (
    <main className="app-shell">
      <div className="ex-bar">
        <Link href="/" className="ex-back" aria-label="חזרה"><CloseIcon /></Link>
        <div className="ex-head-title">האולפן שלי</div>
        <div className="ex-coins"><CoinIcon /><span>{coins}</span></div>
      </div>

      <div className="screen-body av-edit">
        <div className="av-stage"><Avatar config={cfg} size={168} /></div>

        {note && <p className="av-note">{note}</p>}

        <Swatches label="גוון עור" values={SKIN} current={cfg.skin_tone}
          onPick={(v) => set({ skin_tone: v })} />
        <Swatches label="צבע שיער" values={HAIR} current={cfg.hair_color}
          onPick={(v) => set({ hair_color: v })} />
        <Swatches label="צבע חולצה" values={TOP} current={cfg.top_color}
          onPick={(v) => set({ top_color: v })} />

        <Chips label="תסרוקת" options={HAIRSTYLES} current={cfg.hairstyle_id} owned={owned}
          shopByValue={shopByValue} buying={buying} onBuy={buy}
          onPick={(id) => set({ hairstyle_id: id })} />
        <Chips label="אקססורי" options={ACCESSORIES} current={cfg.accessory_id} owned={owned}
          shopByValue={shopByValue} buying={buying} onBuy={buy}
          onPick={(id) => set({ accessory_id: id })} />
        <Chips label="דמות" options={BASES} current={cfg.base}
          onPick={(id) => set({ base: id as AvatarConfig['base'] })} />

        <div className="foot">
          <button className="cta" onClick={save} disabled={status === 'saving'}>
            {status === 'saving' ? 'שומר…' : status === 'saved' ? 'נשמר' : 'שמירה'}
          </button>
          {status === 'error' && <p className="av-err">לא הצלחנו לשמור. נסי שוב.</p>}
        </div>
      </div>
    </main>
  );
}

function Swatches({ label, values, current, onPick }: {
  label: string; values: string[]; current: string; onPick: (v: string) => void;
}) {
  return (
    <div className="av-group">
      <div className="av-label">{label}</div>
      <div className="av-row">
        {values.map((v) => (
          <button key={v} className={`swatch${current === v ? ' on' : ''}`}
            style={{ background: v }} onClick={() => onPick(v)} aria-label={v}>
            {current === v && <CheckIcon />}
          </button>
        ))}
      </div>
    </div>
  );
}

function Chips<T extends string | null>({
  label, options, current, onPick, owned, shopByValue, buying, onBuy,
}: {
  label: string; options: OptDef<T>[]; current: T; onPick: (id: T) => void; owned?: Set<string>;
  shopByValue?: Map<string, ShopItem>; buying?: string | null; onBuy?: (value: string) => void;
}) {
  const anyLocked = !!owned && options.some((o) => o.premium && !owned.has(o.id as string));
  return (
    <div className="av-group">
      <div className="av-label">{label}</div>
      <div className="av-row">
        {options.map((o) => {
          const value = o.id as string;
          const locked = !!o.premium && !(owned?.has(value));
          const item = shopByValue?.get(value);
          const isBuying = buying === value;
          return (
            <button key={o.id ?? 'none'}
              className={`chip${current === o.id ? ' on' : ''}${locked ? ' locked' : ''}`}
              onClick={() => (locked ? onBuy?.(value) : onPick(o.id))}
              disabled={isBuying}>
              {o.label}
              {locked && (item
                ? <span className="chip-price"><CoinIcon /> {isBuying ? '…' : item.cost}</span>
                : <span className="chip-lock"><LockIcon /></span>)}
            </button>
          );
        })}
      </div>
      {anyLocked && <div className="av-buy-hint">פריטים נעולים? הקישי עליהם כדי לקנות במטבעות</div>}
    </div>
  );
}
