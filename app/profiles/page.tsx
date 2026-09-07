'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { Capi } from '@/components/Capi';
import { CoinIcon, FlameIcon, GearIcon } from '@/components/icons';
import { CHILD_COOKIE } from '@/lib/constants';
import { mili, miliAvatar } from '@/lib/mockData';
import type { AvatarConfig } from '@/lib/types';

interface Kid {
  id: string;
  name: string;
  grade: string | null;
  coins: number;
  streak: number;
  avatar: AvatarConfig;
  started?: boolean;
}

const GRADE_LABEL: Record<string, string> = {
  grade_3: 'כיתה ג׳',
  grade_5: 'כיתה ה׳',
};

const MOCK: Kid[] = [
  { id: '', name: mili.display_name, grade: 'grade_3', coins: mili.quest_coins, streak: mili.current_streak, avatar: miliAvatar },
];

export default function ProfilesPage() {
  const router = useRouter();
  const [kids, setKids] = useState<Kid[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/children')
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setKids(Array.isArray(j?.children) && j.children.length ? j.children : MOCK);
      })
      .catch(() => alive && setKids(MOCK));
    return () => { alive = false; };
  }, []);

  function choose(kid: Kid) {
    if (kid.id) {
      document.cookie = `${CHILD_COOKIE}=${kid.id}; path=/; max-age=31536000; samesite=lax`;
    }
    // A child who already practiced never sees onboarding again (even on a new
    // device). Otherwise, first time on this device → guided onboarding.
    let onboarded = true;
    try {
      onboarded = !kid.id || !!kid.started || !!localStorage.getItem('ql_onboarded_' + kid.id);
    } catch { onboarded = true; }
    router.push(onboarded ? '/' : '/onboarding');
    router.refresh();
  }

  return (
    <main className="app-shell">
      <div className="screen-body profiles">
        <div className="profiles-head">
          <Capi mood="cheer" size={92} />
          <h1>מי משחקת עכשיו?</h1>
          <p>איזה פרופיל ממשיך במסע?</p>
        </div>

        <div className="profile-grid">
          {(kids ?? []).map((kid, i) => (
            <button key={kid.id || i} className="profile-card" onClick={() => choose(kid)}>
              <div className="profile-av"><Avatar config={kid.avatar} crop size={96} /></div>
              <div className="profile-name">{kid.name}</div>
              {kid.grade && <div className="profile-grade">{GRADE_LABEL[kid.grade] ?? ''}</div>}
              <div className="profile-stats">
                <span><CoinIcon /> {kid.coins}</span>
                <span><FlameIcon /> {kid.streak}</span>
              </div>
            </button>
          ))}
          {kids === null && <div className="profile-loading">טוען פרופילים…</div>}
        </div>

        <div className="profiles-foot">
          <Link href="/parent" className="profiles-parent"><GearIcon /> אזור הורים</Link>
        </div>
      </div>
    </main>
  );
}
