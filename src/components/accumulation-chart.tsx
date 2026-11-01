"use client";

import { useMemo, useState } from "react";
import type { YearRow } from "@/lib/calc";
import { formatRubCompact } from "@/lib/format";

type Props = {
  history: YearRow[];
  years: number | null;
};

export function AccumulationChart({ history, years }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const visible = useMemo(() => {
    if (history.length === 0) return [];
    const cutoff = years ? Math.min(history.length, years + 4) : Math.min(history.length, 40);
    return history.slice(0, cutoff);
  }, [history, years]);

  if (visible.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Недостаточно данных для графика
      </div>
    );
  }

  const width = 720;
  const height = 280;
  const pad = { top: 24, right: 16, bottom: 36, left: 58 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const finiteNeeded = visible.filter((row) => Number.isFinite(row.needed));
  const maxY = Math.max(
    ...visible.map((row) => row.balance),
    ...finiteNeeded.map((row) => row.needed),
    1,
  );
  const maxYear = visible[visible.length - 1].year;

  const x = (year: number) => pad.left + ((year - 1) / Math.max(maxYear - 1, 1)) * innerW;
  const y = (value: number) => pad.top + innerH - (value / maxY) * innerH;

  const toPath = (values: number[]) =>
    values
      .map((value, index) => `${index === 0 ? "M" : "L"} ${x(visible[index].year).toFixed(1)} ${y(value).toFixed(1)}`)
      .join(" ");

  const balancePath = toPath(visible.map((row) => row.balance));
  const neededValues = visible.map((row) => (Number.isFinite(row.needed) ? row.needed : maxY * 1.05));
  const neededPath = toPath(neededValues);
  const areaPath = `${balancePath} L ${x(visible[visible.length - 1].year).toFixed(1)} ${pad.top + innerH} L ${x(visible[0].year).toFixed(1)} ${pad.top + innerH} Z`;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (maxY * i) / ticks);
  const xTicks = visible.filter((row) => row.year === 1 || row.year % 5 === 0 || row.year === maxYear);
  const active = hover !== null ? visible[hover] : years ? visible[years - 1] : visible[visible.length - 1];

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="График накопления капитала и растущей цели"
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth="1"
            />
            <text
              x={pad.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {formatRubCompact(tick)}
            </text>
          </g>
        ))}

        {xTicks.map((row) => (
          <text
            key={row.year}
            x={x(row.year)}
            y={height - 10}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {row.year}
          </text>
        ))}

        <path d={areaPath} className="fill-primary/10" />
        <path d={neededPath} className="stroke-destructive/70" fill="none" strokeWidth="2" strokeDasharray="5 5" />
        <path d={balancePath} className="stroke-primary" fill="none" strokeWidth="2.5" />

        {visible.map((row, index) => (
          <rect
            key={row.year}
            x={x(row.year) - innerW / visible.length / 2}
            y={pad.top}
            width={innerW / visible.length}
            height={innerH}
            className="fill-transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}

        {active && (
          <>
            <line
              x1={x(active.year)}
              x2={x(active.year)}
              y1={pad.top}
              y2={pad.top + innerH}
              className="stroke-foreground/20"
              strokeWidth="1"
            />
            <circle cx={x(active.year)} cy={y(active.balance)} r="4.5" className="fill-primary" />
            {Number.isFinite(active.needed) && (
              <circle cx={x(active.year)} cy={y(active.needed)} r="4" className="fill-destructive" />
            )}
          </>
        )}
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 bg-primary" />
            Накоплено
          </span>
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="h-px w-4 border-t-2 border-dashed border-destructive/70" />
            Нужно к этому году
          </span>
        </div>
        {active && (
          <p className="text-muted-foreground">
            {active.year}-й год: {formatRubCompact(active.balance)}
            {Number.isFinite(active.needed) ? ` из ${formatRubCompact(active.needed)}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
