export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-900">
      <div className="absolute inset-0 grid-backdrop" />
      <div className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-yolk-500/20 blur-[120px]" />
      <div className="absolute top-1/3 -left-32 h-[380px] w-[380px] rounded-full bg-yolk-600/10 blur-[100px] animate-float" />
      <div
        className="absolute bottom-0 -right-20 h-[420px] w-[420px] rounded-full bg-yolk-400/10 blur-[110px] animate-float"
        style={{ animationDelay: '-3s' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-900" />
    </div>
  )
}
