import type { AvatarConfig } from '@/lib/types';

/**
 * Modular layered avatar (v5.2). Composes SVG layers from an AvatarConfig:
 * base (girl/boy), skin tone, hairstyle + hair color, top, and accessory.
 * `crop` shows a head+shoulders square for small header slots.
 */
export function Avatar({
  config,
  size = 120,
  crop = false,
}: {
  config: AvatarConfig;
  size?: number;
  crop?: boolean;
}) {
  const { base, skin_tone: skin, hair_color: hair, top_color: top, accessory_id, hairstyle_id } = config;
  const isGirl = base === 'girl';
  const ponytail = hairstyle_id === 'ponytail';
  const longHair = hairstyle_id !== 'short' && !ponytail;
  const viewBox = crop ? '46 32 108 108' : '0 0 200 168';

  return (
    <svg width={size} height={size} viewBox={viewBox} role="img" aria-label="אווטאר">
      <defs>
        {/* soft top-left key light → gives every surface claymation volume */}
        <radialGradient id="avLight" cx="34%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* shoulders / top */}
      <path d="M34 200 C34 156 62 138 100 138 C138 138 166 156 166 200 Z" fill={top} />
      {/* shoulder shading: soft highlight on the left, gentle shadow at the fold */}
      <path d="M34 200 C34 156 62 138 100 138 C138 138 166 156 166 200 Z" fill="url(#avLight)" />
      <path d="M84 140 L100 156 L116 140 Z" fill="rgba(0,0,0,.14)" />
      <path d="M100 138 C138 138 166 156 166 200 L150 200 C150 164 128 148 100 146 Z" fill="rgba(0,0,0,.10)" />
      {/* neck */}
      <path d="M88 118 h24 v16 a12 12 0 0 1 -24 0 Z" fill={skin} />
      <path d="M88 118 h24 v6 a12 12 0 0 1 -24 0 Z" fill="rgba(0,0,0,.08)" />
      {/* hair back (long styles only) */}
      {isGirl && longHair && (
        <path
          d="M52 94 C52 52 74 34 100 34 C126 34 148 52 148 94 L148 152 C140 146 132 144 126 144 L74 144 C68 144 60 146 52 152 Z"
          fill={hair}
        />
      )}
      {/* hairstyle: ponytail (tie + swept tail on the side) */}
      {isGirl && ponytail && (
        <g>
          <path d="M56 92 C56 54 76 36 100 36 C124 36 144 54 144 92 C136 78 120 70 100 70 C80 70 64 78 56 92 Z" fill={hair} />
          <path d="M140 74 C164 78 176 100 172 128 C170 142 162 150 152 150 C160 136 158 112 146 96 C142 90 140 82 140 74 Z" fill={hair} />
          <ellipse cx="140" cy="80" rx="7" ry="8" fill="#FF2A85" />
        </g>
      )}
      {/* ears */}
      <circle cx="62" cy="98" r="9" fill={skin} />
      <circle cx="138" cy="98" r="9" fill={skin} />
      {/* face */}
      <ellipse cx="100" cy="94" rx="40" ry="44" fill={skin} />
      {/* face volume: jaw ambient shadow + top-left key highlight */}
      <ellipse cx="100" cy="112" rx="34" ry="22" fill="rgba(0,0,0,.07)" />
      <ellipse cx="100" cy="94" rx="40" ry="44" fill="url(#avLight)" />
      {/* fringe / hair top */}
      {isGirl ? (
        <path d="M60 82 C64 50 82 40 100 40 C118 40 136 50 140 82 C128 66 116 60 100 60 C84 60 72 66 60 82 Z" fill={hair} />
      ) : (
        <path d="M58 84 C58 46 78 36 100 36 C122 36 142 46 142 84 C130 66 116 60 100 60 C84 60 70 66 58 84 Z" fill={hair} />
      )}
      {/* glossy hair sheen streak (claymation shine) */}
      <path d="M72 58 C80 46 92 42 104 44 C96 48 88 54 82 64 C78 62 75 60 72 58 Z"
        fill="#fff" opacity="0.22" />
      {/* brows */}
      <path d="M76 86 q9 -5 18 -1" fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="3" strokeLinecap="round" />
      <path d="M106 85 q9 -4 18 1" fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="3" strokeLinecap="round" />
      {/* eyes */}
      <circle cx="84" cy="98" r="6" fill="#2A1D1A" />
      <circle cx="116" cy="98" r="6" fill="#2A1D1A" />
      <circle cx="86" cy="96" r="2" fill="#fff" />
      <circle cx="118" cy="96" r="2" fill="#fff" />
      {/* blush */}
      <ellipse cx="74" cy="110" rx="7" ry="4.5" fill="#FF6F9C" opacity="0.4" />
      <ellipse cx="126" cy="110" rx="7" ry="4.5" fill="#FF6F9C" opacity="0.4" />
      {/* nose + smile */}
      <path d="M100 104 q3 4 0 7" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M86 116 q14 11 28 0" fill="none" stroke="#C2506E" strokeWidth="3.4" strokeLinecap="round" />
      {/* accessory: bow */}
      {isGirl && accessory_id === 'bow' && (
        <g>
          <path d="M128 44 l14 -6 0 14 z" fill="#FF2A85" />
          <path d="M128 44 l14 6 0 -14 z" fill="#FF2A85" />
          <circle cx="128" cy="44" r="4.5" fill="#C21361" />
        </g>
      )}
      {/* accessory: glasses */}
      {accessory_id === 'glasses' && (
        <g fill="none" stroke="#2A1D1A" strokeWidth="3">
          <circle cx="84" cy="98" r="12" />
          <circle cx="116" cy="98" r="12" />
          <path d="M96 98 h8" strokeLinecap="round" />
          <path d="M72 96 l-9 -3M128 96 l9 -3" strokeLinecap="round" />
        </g>
      )}
      {/* accessory: crown (premium) */}
      {accessory_id === 'crown' && (
        <g>
          <path d="M68 52 L74 32 L88 46 L100 26 L112 46 L126 32 L132 52 Z" fill="#FFD23F" stroke="#E0A400" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="74" cy="32" r="4" fill="#FF3D8B" />
          <circle cx="100" cy="26" r="4.5" fill="#38BDF8" />
          <circle cx="126" cy="32" r="4" fill="#FF3D8B" />
          <rect x="68" y="50" width="64" height="7" rx="2" fill="#FFC21F" />
        </g>
      )}
      {/* accessory: headphones (premium) */}
      {accessory_id === 'headphones' && (
        <g>
          <path d="M56 96 C56 58 76 42 100 42 C124 42 144 58 144 96" fill="none" stroke="#7C3AED" strokeWidth="7" strokeLinecap="round" />
          <rect x="48" y="90" width="16" height="26" rx="7" fill="#7C3AED" />
          <rect x="136" y="90" width="16" height="26" rx="7" fill="#7C3AED" />
          <rect x="51" y="94" width="10" height="18" rx="5" fill="#C4B5FD" />
          <rect x="139" y="94" width="10" height="18" rx="5" fill="#C4B5FD" />
        </g>
      )}
      {/* accessory: flower (premium) */}
      {accessory_id === 'flower' && (
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="132" cy="58" rx="6" ry="9"
              fill="#FF6FB5" transform={`rotate(${a} 132 58)`} />
          ))}
          <circle cx="132" cy="58" r="5" fill="#FFD23F" />
        </g>
      )}
      {/* accessory: star clip (premium) */}
      {accessory_id === 'star' && (
        <path d="M128 49 L130.2 54.9 L136.6 55.2 L131.6 59.2 L133.3 65.3 L128 61.8 L122.7 65.3 L124.4 59.2 L119.4 55.2 L125.8 54.9 Z"
          fill="#FFD23F" stroke="#E0A400" strokeWidth="1.5" strokeLinejoin="round" />
      )}
      {/* accessory: earrings (premium) */}
      {accessory_id === 'earrings' && (
        <g stroke="#0C7CB5" strokeWidth="1">
          <circle cx="62" cy="110" r="3.4" fill="#38BDF8" />
          <circle cx="138" cy="110" r="3.4" fill="#38BDF8" />
        </g>
      )}
      {/* accessory: sunglasses (premium) */}
      {accessory_id === 'sunglasses' && (
        <g>
          <circle cx="84" cy="98" r="12" fill="#2A1D1A" />
          <circle cx="116" cy="98" r="12" fill="#2A1D1A" />
          <path d="M96 96 h8" stroke="#2A1D1A" strokeWidth="3" strokeLinecap="round" />
          <path d="M72 94 l-9 -3M128 94 l9 -3" fill="none" stroke="#2A1D1A" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="80" cy="94" rx="3" ry="2" fill="#fff" opacity="0.35" />
          <ellipse cx="112" cy="94" rx="3" ry="2" fill="#fff" opacity="0.35" />
        </g>
      )}
    </svg>
  );
}
