import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Logo } from '@/components/Logo'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <h1 className="font-display text-6xl font-bold text-gradient-yolk">404</h1>
      <p className="text-white/60">This page didn't make the cut.</p>
      <Link to="/">
        <Button>Back to home</Button>
      </Link>
    </div>
  )
}
