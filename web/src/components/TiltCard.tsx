import { useRef, type ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Props {
  children: ReactNode
  className?: string
  glare?: boolean
  intensity?: number
}

export function TiltCard({ children, className, glare = true, intensity = 12 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [intensity, -intensity]), {
    stiffness: 200,
    damping: 20,
  })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-intensity, intensity]), {
    stiffness: 200,
    damping: 20,
  })
  const glareX = useTransform(x, [-0.5, 0.5], ['0%', '100%'])
  const glareY = useTransform(y, [-0.5, 0.5], ['0%', '100%'])
  const glareBg = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,224,71,0.25), transparent 60%)`

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  function onMouseLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <div className={cn('perspective-1000', className)}>
      <motion.div
        ref={ref}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative h-full w-full preserve-3d"
      >
        {children}
        {glare && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 hover:opacity-100 transition-opacity"
            style={{ background: glareBg }}
          />
        )}
      </motion.div>
    </div>
  )
}
