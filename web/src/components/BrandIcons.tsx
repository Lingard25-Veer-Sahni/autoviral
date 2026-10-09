// lucide-react dropped trademarked brand glyphs, so we ship minimal inline
// SVG equivalents with the same `className` prop signature used everywhere else.
import type { SVGProps } from 'react'

export function Youtube(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M21.58 7.19a2.51 2.51 0 0 0-1.77-1.78C18.25 5 12 5 12 5s-6.25 0-7.81.41a2.51 2.51 0 0 0-1.77 1.78A26.3 26.3 0 0 0 2 12a26.3 26.3 0 0 0 .42 4.81 2.51 2.51 0 0 0 1.77 1.78C5.75 19 12 19 12 19s6.25 0 7.81-.41a2.51 2.51 0 0 0 1.77-1.78A26.3 26.3 0 0 0 22 12a26.3 26.3 0 0 0-.42-4.81Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path d="M10 15.02V8.98L15.5 12 10 15.02Z" fill="currentColor" />
    </svg>
  )
}

export function Instagram(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" />
    </svg>
  )
}
