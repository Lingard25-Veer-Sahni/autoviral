import { Link } from 'react-router-dom'
import { Card } from '@/components/Card'
import { Logo } from '@/components/Logo'

// Minimal, plain-language Terms & Conditions. The one legally/operationally
// load-bearing clause here is the no-refund-on-failure policy — it's
// referenced from Signup.tsx's signup form and is what justifies the
// generation pricing formula in server/src/services/aiSchema.ts
// (creditsForEstimatedCost already assumes ~50% of attempts fail and prices
// accordingly, so a failed attempt isn't an unexpected loss to absorb twice).
export default function Terms() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <Link to="/" className="mb-10 self-start">
        <Logo />
      </Link>
      <Card>
        <h1 className="font-display text-2xl font-semibold text-white">Terms &amp; Conditions</h1>
        <div className="mt-6 space-y-5 text-sm leading-relaxed text-white/60">
          <section>
            <h2 className="font-medium text-white">Credits</h2>
            <p className="mt-1">
              Generating a video costs a number of credits determined by the selected video length, shown before
              you confirm generation. Credits are deducted when generation starts.
            </p>
          </section>
          <section>
            <h2 className="font-medium text-white">No refunds on failed generations</h2>
            <p className="mt-1">
              Credits spent on a video generation attempt that fails are <strong className="text-white">not
              refunded</strong>, regardless of the reason for the failure. Generating a video has a real cost
              (AI usage, narration, and render/storage time) that is incurred the moment an attempt starts, whether
              or not it ultimately succeeds. Our credit pricing is set with this in mind — it already accounts for
              a meaningful share of attempts failing, so pricing (not refunds) is how that risk is covered. If you
              experience a failure, please try generating again.
            </p>
          </section>
          <section>
            <h2 className="font-medium text-white">Acceptable use</h2>
            <p className="mt-1">
              You're responsible for the content you generate and publish through your connected accounts (YouTube,
              Instagram, etc.) and for complying with those platforms' own terms.
            </p>
          </section>
          <section>
            <h2 className="font-medium text-white">Changes</h2>
            <p className="mt-1">
              These terms may be updated from time to time; continued use of the service after a change constitutes
              acceptance of the updated terms.
            </p>
          </section>
        </div>
      </Card>
    </div>
  )
}
