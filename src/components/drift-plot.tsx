/**
 * One concern's readings plotted against its own tolerance band.
 *
 * The manifest names the data itself as this project's ornament source, and this
 * is where that is paid off. The instrument table already carries the numbers,
 * but a column of figures cannot show the one thing that matters most: whether a
 * reading wandered further than the instrument's own error allows.
 *
 * The band is the noise floor, centred on the first session. Every session mean
 * is a mark. A mark inside the band is indistinguishable from measurement error.
 * A mark outside it moved further than the instrument can explain, which on a
 * subject who did not change is drift, not skin.
 *
 * Radiance is the row this exists for: three marks walking steadily out of the
 * band across fifteen minutes of someone sitting still.
 */
export function DriftPlot({
  values,
  floor,
  width = 132,
  height = 30,
}: {
  values: number[];
  floor: number;
  width?: number;
  height?: number;
}) {
  if (values.length < 2 || floor <= 0) return null;

  const baseline = values[0];
  const deviations = values.map((v) => v - baseline);

  // The axis must always show the whole band plus any mark that escapes it, so
  // an in-tolerance row and an out-of-tolerance row stay visually comparable.
  const extent = Math.max(floor * 1.5, ...deviations.map((d) => Math.abs(d) * 1.2));
  const midY = height / 2;
  const toX = (deviation: number) => width / 2 + (deviation / extent) * (width / 2 - 4);

  const bandLeft = toX(-floor);
  const bandRight = toX(floor);
  const escaped = deviations.some((d) => Math.abs(d) > floor);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={
        escaped
          ? `Readings drift beyond the ${floor.toFixed(1)} point tolerance band`
          : `All readings stay inside the ${floor.toFixed(1)} point tolerance band`
      }
      className="overflow-visible"
    >
      {/* The tolerance band: everything in here is indistinguishable from noise. */}
      <rect
        x={bandLeft}
        y={midY - 7}
        width={Math.max(bandRight - bandLeft, 1)}
        height={14}
        fill="var(--color-surface-sunken)"
      />
      <line
        x1={bandLeft}
        y1={midY - 7}
        x2={bandLeft}
        y2={midY + 7}
        stroke="var(--color-rule-strong)"
        strokeWidth="1"
      />
      <line
        x1={bandRight}
        y1={midY - 7}
        x2={bandRight}
        y2={midY + 7}
        stroke="var(--color-rule-strong)"
        strokeWidth="1"
      />

      {/* Baseline: where the first session sat. */}
      <line
        x1={toX(0)}
        y1={midY - 10}
        x2={toX(0)}
        y2={midY + 10}
        stroke="var(--color-ink)"
        strokeWidth="1"
      />

      {/* The path the readings actually took. */}
      <polyline
        points={deviations.map((d, i) => `${toX(d)},${midY - 4 + i * 4}`).join(" ")}
        fill="none"
        stroke={escaped ? "var(--color-ink)" : "var(--color-spot)"}
        strokeWidth="1"
        opacity="0.5"
      />

      {deviations.map((d, i) => {
        const outside = Math.abs(d) > floor;
        return (
          <circle
            key={i}
            cx={toX(d)}
            cy={midY - 4 + i * 4}
            r={outside ? 3 : 2.2}
            // Out of tolerance takes solid ink, the way a certificate stamps a
            // failure rather than colouring it in. In tolerance takes the spot.
            fill={outside ? "var(--color-ink)" : "var(--color-spot)"}
          />
        );
      })}
    </svg>
  );
}
