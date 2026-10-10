import { X } from 'lucide-react'
import { TermsContent } from './TermsContent'

// In-page scrollable overlay for the Terms & Conditions / Privacy Policy,
// opened from Signup.tsx's "Terms & Conditions and Privacy Policy" link.
// Avoids a full page navigation to /terms entirely (no reliance on the
// static host's SPA fallback / client-side routing working for a fresh
// page load), the user just scrolls within this panel and closes it to
// return to the signup form.
export function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-ink-800 shadow-glow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-white">Terms &amp; Conditions / Privacy Policy</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <TermsContent />
        </div>
        <div className="border-t border-white/10 px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-yolk-500 px-4 py-2 text-xs font-semibold text-ink-900 hover:bg-yolk-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
