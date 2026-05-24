// src/components/SourceMiniSparkline.tsx
'use client';

import React from 'react';

interface SourceMiniSparklineProps {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Schlanke SVG-Sparkline. Kein recharts overhead — minimal & schnell für Liste.
 * Zeigt Trend-Linie + Gradient-Fill.
 */
export default function SourceMiniSparkline({
  values,
  color = '#9ca3af',
  width = 60,
  height = 20,
  className,
}: SourceMiniSparklineProps) {
  if (!values || values.length < 2) {
    return <span className={className} style={{ width, height, display: 'inline-block' }} aria-hidden />;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  // Y-Koordinate: invertieren (SVG-Origin oben links) und ein bisschen Padding
  const padding = 2;
  const usableHeight = height - padding * 2;
  const toY = (v: number) => padding + usableHeight - ((v - min) / range) * usableHeight;

  const points = values.map((v, i) => `${i * step},${toY(v)}`).join(' ');
  const linePath = `M ${points.split(' ').join(' L ')}`;
  const fillPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  const gradientId = `sparkline-grad-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
