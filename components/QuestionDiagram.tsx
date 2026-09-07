import type { DiagramSpec } from '@/lib/types';

/**
 * Draws a small, deterministic illustration for a question (geometry shapes or a
 * row of simple shapes for reasoning items). Pure SVG - no external images. Every
 * value is validated/clamped so a bad spec renders nothing rather than breaking.
 */
export function QuestionDiagram({ spec }: { spec?: DiagramSpec }) {
  if (!spec || typeof spec !== 'object') return null;
  const body = render(spec);
  if (!body) return null;
  return <div className="qdiagram">{body}</div>;
}

const STROKE = '#FF2A85';
const FILL = 'rgba(255,42,133,.12)';
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);

function label(x: number, y: number, text: string) {
  return <text x={x} y={y} fontSize="13" fontWeight="700" fill="var(--ink)" textAnchor="middle" dominantBaseline="middle">{text}</text>;
}

function render(spec: DiagramSpec) {
  const unit = spec.unit ? ` ${String(spec.unit).slice(0, 6)}` : '';
  const W = 220, H = 150;

  if (spec.kind === 'rect' || spec.kind === 'square') {
    const w = num(spec.w) ?? num(spec.s);
    const h = spec.kind === 'square' ? w : num(spec.h);
    if (!w || !h) return null;
    // Fit the shape into the box, keeping aspect ratio.
    const maxW = 150, maxH = 90;
    const scale = Math.min(maxW / w, maxH / h);
    const rw = Math.max(30, w * scale), rh = Math.max(24, h * scale);
    const x = (W - rw) / 2, y = (H - rh) / 2;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="150" role="img" aria-label="צורה">
        <rect x={x} y={y} width={rw} height={rh} fill={FILL} stroke={STROKE} strokeWidth="2.5" rx="4" />
        {label(W / 2, y + rh + 16, `${w}${unit}`)}
        {label(x - 16, H / 2, `${h}${unit}`)}
      </svg>
    );
  }

  if (spec.kind === 'triangle') {
    const base = num(spec.base), height = num(spec.height);
    if (!base || !height) return null;
    const maxW = 150, maxH = 90;
    const scale = Math.min(maxW / base, maxH / height);
    const bw = Math.max(40, base * scale), bh = Math.max(30, height * scale);
    const x0 = (W - bw) / 2, yb = (H + bh) / 2, apexX = x0;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="150" role="img" aria-label="משולש">
        <polygon points={`${x0},${yb} ${x0 + bw},${yb} ${apexX},${yb - bh}`} fill={FILL} stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
        <line x1={apexX} y1={yb - bh} x2={apexX} y2={yb} stroke={STROKE} strokeWidth="1.5" strokeDasharray="4 3" />
        {label((x0 + x0 + bw) / 2, yb + 16, `בסיס ${base}${unit}`)}
        {label(apexX - 22, yb - bh / 2, `גובה ${height}${unit}`)}
      </svg>
    );
  }

  if (spec.kind === 'circle') {
    const r = num(spec.r);
    if (!r) return null;
    const rr = Math.max(28, Math.min(60, r * 8));
    const cx = W / 2, cy = H / 2;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="150" role="img" aria-label="עיגול">
        <circle cx={cx} cy={cy} r={rr} fill={FILL} stroke={STROKE} strokeWidth="2.5" />
        <line x1={cx} y1={cy} x2={cx + rr} y2={cy} stroke={STROKE} strokeWidth="1.5" />
        {label(cx + rr / 2, cy - 12, `רדיוס ${r}${unit}`)}
        <circle cx={cx} cy={cy} r="2.5" fill={STROKE} />
      </svg>
    );
  }

  if (spec.kind === 'shapes') {
    const items = Array.isArray(spec.items) ? spec.items.slice(0, 6) : [];
    if (!items.length) return null;
    const n = items.length;
    const gap = W / n;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="150" role="img" aria-label="צורות">
        {items.map((it, i) => {
          const cx = gap * (i + 0.5), cy = H / 2;
          const col = typeof it?.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(it.color) ? it.color : STROKE;
          const fill = col + '22';
          const s = 26;
          if (it?.shape === 'square') return <rect key={i} x={cx - s} y={cy - s} width={s * 2} height={s * 2} rx="4" fill={fill} stroke={col} strokeWidth="2.5" />;
          if (it?.shape === 'triangle') return <polygon key={i} points={`${cx},${cy - s} ${cx + s},${cy + s} ${cx - s},${cy + s}`} fill={fill} stroke={col} strokeWidth="2.5" strokeLinejoin="round" />;
          if (it?.shape === 'star') {
            const pts = starPoints(cx, cy, s, s * 0.45);
            return <polygon key={i} points={pts} fill={fill} stroke={col} strokeWidth="2.5" strokeLinejoin="round" />;
          }
          return <circle key={i} cx={cx} cy={cy} r={s} fill={fill} stroke={col} strokeWidth="2.5" />;
        })}
      </svg>
    );
  }

  return null;
}

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(`${(cx + r * Math.cos(rad)).toFixed(1)},${(cy + r * Math.sin(rad)).toFixed(1)}`);
  }
  return pts.join(' ');
}
