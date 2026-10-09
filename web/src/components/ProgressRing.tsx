/** Small circular progress indicator for real (non-simulated) 0-100 pipeline progress. */
export function ProgressRing({ percent, size = 56 }: { percent: number; size?: number }) {
  const clamped = Math.min(100, Math.max(0, percent))
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#f5c400"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 300ms ease' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="rotate-90 fill-white text-[13px] font-semibold"
        style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
      >
        {clamped}%
      </text>
    </svg>
  )
}
