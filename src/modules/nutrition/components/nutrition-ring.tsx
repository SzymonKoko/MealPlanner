interface NutritionRingProps {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  decimals?: number;
  color: string;
}

export function NutritionRing({
  label,
  consumed,
  target,
  unit,
  decimals = 0,
  color,
}: NutritionRingProps) {
  const hasTarget = target > 0;
  const rawPercent = hasTarget ? (consumed / target) * 100 : 0;
  const displayPercent = hasTarget ? Math.min(100, rawPercent) : 0;
  const overTarget = hasTarget && rawPercent > 100;

  const size = 112;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayPercent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={stroke}
          />
          {hasTarget ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={overTarget ? "var(--color-destructive)" : color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums leading-none">
            {hasTarget ? `${Math.round(rawPercent)}%` : "—"}
          </span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {consumed.toFixed(decimals)}
          {hasTarget ? ` / ${target.toFixed(decimals)}` : ""} {unit}
        </p>
      </div>
    </div>
  );
}
