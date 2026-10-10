import { Link } from 'react-router-dom'
import { Card } from '@/components/Card'
import { Logo } from '@/components/Logo'
import { TermsContent } from '@/components/TermsContent'

// Standalone Terms & Conditions / Privacy Policy page. The content itself
// lives in TermsContent.tsx, shared with the in-page scrollable modal opened
// from Signup.tsx (TermsModal.tsx) since a direct/new-tab navigation to this
// route depends on the static host's SPA fallback being configured correctly.
export default function Terms() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <Link to="/" className="mb-10 self-start">
        <Logo />
      </Link>
      <Card>
        <h1 className="font-display text-2xl font-semibold text-white">Terms &amp; Conditions / Privacy Policy</h1>
        <div className="mt-6">
          <TermsContent />
        </div>
      </Card>
    </div>
  )
}
