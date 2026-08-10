import type { VerdictState } from "@/lib/stats/verdict";

/**
 * The signature visual: an observed change plotted against the band of changes
 * this instrument cannot distinguish from its own error.
 *
 * The shaded band spans −MDC95 to +MDC95. Anything landing inside it is, by
 * definition, indistinguishable from noise. Putting the band on screen is the
 * fastest way to explain why "+9 radiance" can mean nothing at all: the reader
 * sees the marker sitting inside the grey and understands immediately.
 *
 * The optional `naiveChange` marker shows what a tracker without a floor would
 * have reported from the same data, which is the whole argument in one row.
 */
export function NoiseFloorChart({
  change,
  mdc95,
  state,
  naiveChange,
  height = 68,
}: {
  change: number;
  mdc95: number;
  state: VerdictState;
  naiveChange?: number;
  height?: number;
}) {
  // The axis always shows the full noise band plus whatever sits outside it,
  // with a margin so a marker never touches the edge.
  const extent = Math.max(
    mdc95 * 1.9,
    Math.abs(change) * 1.35,
    Math.abs(naiveChange ?? 0) * 1.35,
    4,
  );

  const width = 100;
  const midY = height / 2;
  const toX = (value: number) => 50 + (value / extent) * 50;

  const bandLeft = toX(-mdc95);
  const bandRight = toX(mdc95);
  const markerX = toX(change);

  const tone = TONE[state];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-[68px] w-full"
      role="img"
      aria-label={`Observed change ${change.toFixed(1)} points against a noise floor of plus or minus ${mdc95.toFixed(1)} points`}
    >
      {/* The band of changes that cannot be distinguished from measurement error. */}
      <rect
        x={bandLeft}
        y={midY - 13}
        width={Math.max(bandRight - bandLeft, 0.5)}
        height={26}
        fill="var(--color-verdict-null-bg)"
      />
      <line
        x1={bandLeft}
        y1={midY - 13}
        x2={bandLeft}
        y2={midY + 13}
        stroke="var(--color-rule-strong)"
        strokeWidth="0.4"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={bandRight}
        y1={midY - 13}
        x2={bandRight}
        y2={midY + 13}
        stroke="var(--color-rule-strong)"
        strokeWidth="0.4"
        vectorEffect="non-scaling-stroke"
      />

      {/* Baseline: zero change. */}
      <line
        x1={0}
        y1={midY}
        x2={width}
        y2={midY}
        stroke="var(--color-rule)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={50}
        y1={midY - 17}
        x2={50}
        y2={midY + 17}
        stroke="var(--color-rule-strong)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />

      {/* What a tracker with no floor would have claimed. */}
      {naiveChange !== undefined && (
        <g>
          <line
            x1={toX(naiveChange)}
            y1={midY - 20}
            x2={toX(naiveChange)}
            y2={midY + 20}
            stroke="var(--color-ink-muted)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}

      {/* The measured change. */}
      <line
        x1={50}
        y1={midY}
        x2={markerX}
        y2={midY}
        stroke={tone.ink}
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={markerX} cy={midY} r="2.4" fill={tone.ink} />
    </svg>
  );
}

const TONE: Record<VerdictState, { ink: string }> = {
  working: { ink: "var(--color-verdict-working-ink)" },
  worsening: { ink: "var(--color-verdict-worsening-ink)" },
  expected_purge: { ink: "var(--color-verdict-purge-ink)" },
  not_working: { ink: "var(--color-verdict-null-ink)" },
  insufficient_evidence: { ink: "var(--color-verdict-pending-ink)" },
  saturated: { ink: "var(--color-ink-muted)" },
};
