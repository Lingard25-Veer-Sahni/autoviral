import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-yolk-500 text-ink-900 hover:bg-yolk-400 shadow-[0_0_0_1px_rgba(255,184,0,0.4)] hover:shadow-glow font-semibold',
  secondary:
    'bg-ink-600 text-yolk-100 hover:bg-ink-500 border border-white/10',
  outline:
    'bg-transparent text-yolk-400 border border-yolk-500/50 hover:bg-yolk-500/10',
  ghost: 'bg-transparent text-white/70 hover:text-white hover:bg-white/5',
  danger: 'bg-red-600 text-white hover:bg-red-500',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-7 py-3.5 text-base rounded-xl gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled ? 1 : 1.03 }}
        whileTap={{ scale: disabled ? 1 : 0.97 }}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        {...(props as any)}
      >
        {loading && (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        )}
        {children}
      </motion.button>
    )
  }
)
Button.displayName = 'Button'
