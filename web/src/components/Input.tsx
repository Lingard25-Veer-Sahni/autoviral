import { type InputHTMLAttributes, type TextareaHTMLAttributes, type LabelHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-white/80', className)} {...props} />
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-yolk-500/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-yolk-500/20',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-yolk-500/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-yolk-500/20',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
