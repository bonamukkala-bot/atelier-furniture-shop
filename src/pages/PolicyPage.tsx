import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CONTACT_PHONE } from './StorefrontPage'
import { buildWhatsAppLink } from '../lib/whatsapp'
import LanguageToggle from '../components/LanguageToggle'

export type PolicyType = 'privacy' | 'delivery' | 'returns-warranty'

interface PolicyPageProps {
  type: PolicyType
}

const policyMeta: Record<PolicyType, { titleKey: string; defaultTitle: string; slug: string }> = {
  privacy: {
    titleKey: 'footer.privacy',
    defaultTitle: 'Privacy Policy',
    slug: '/privacy',
  },
  delivery: {
    titleKey: 'footer.delivery',
    defaultTitle: 'Delivery Policy',
    slug: '/delivery-policy',
  },
  'returns-warranty': {
    titleKey: 'footer.returnsWarranty',
    defaultTitle: 'Returns & Warranty Policy',
    slug: '/returns-warranty',
  },
}

export default function PolicyPage({ type }: PolicyPageProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const meta = policyMeta[type] || policyMeta.privacy
  const title = t(meta.titleKey) || meta.defaultTitle

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col justify-between">
      {/* Skip to main content link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2.5 focus:bg-[var(--bg)] focus:text-[var(--ink)] focus:border-2 focus:border-[var(--gold)] focus:shadow-lg focus:font-semibold focus:text-sm"
      >
        Skip to content
      </a>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[rgba(250,247,242,0.96)] backdrop-blur-md border-b border-[var(--border)] h-[64px] px-4 sm:px-8 flex items-center justify-between">
        <Link to="/" className="flex flex-col group">
          <span className="font-fraunces text-2xl font-semibold tracking-tight text-[var(--ink)] group-hover:text-[var(--gold)] transition-colors">
            ATELIER
          </span>
          <span className="text-[10px] font-semibold tracking-[0.2em] text-[var(--gold)] font-inter uppercase">
            FINE FURNITURE
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-[13px] font-medium text-[var(--muted)] hover:text-[var(--gold)] transition-colors min-h-[44px] inline-flex items-center"
          >
            ← Return to Storefront
          </Link>
          <LanguageToggle />
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
            <li>
              <Link to="/" className="hover:text-[var(--gold)] min-h-[44px] inline-flex items-center">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-[var(--ink)]" aria-current="page">
              {title}
            </li>
          </ol>
        </nav>

        <header className="mb-8 border-b border-[var(--border)] pb-6">
          <span className="text-[13px] font-semibold tracking-[0.18em] uppercase text-[var(--gold)] mb-2 block font-inter">
            Legal & Customer Care
          </span>
          <h1 className="font-fraunces text-3xl sm:text-4xl text-[var(--ink)] font-normal">
            {title}
          </h1>
        </header>

        {/* Clear placeholder policy notice with contact link */}
        <div className="bg-[var(--bg)] border border-[var(--border)] p-6 sm:p-8 rounded-none mb-8">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-[var(--gold)] shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
            <div>
              <h2 className="text-base font-semibold text-[var(--ink)] mb-2">
                Policy Document Status: Pending Owner Provision
              </h2>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed mb-4">
                The detailed terms and conditions for this policy are currently being formalized by Atelier Fine Furniture.
                No arbitrary legal or business terms have been invented.
              </p>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                For immediate assistance regarding order delivery, custom carpentry guarantees, warranty terms, or data handling,
                please contact our showroom directly:
              </p>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-[var(--border)] flex flex-wrap gap-4 items-center justify-between">
            <a
              href="tel:+919014996929"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--gold)] min-h-[44px] px-3 py-2 border border-[var(--border)] transition-colors"
            >
              <svg className="w-4 h-4 text-[var(--gold)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.122-4.1-6.924-6.924l1.293-.97a1.173 1.173 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <span>Call Showroom: {CONTACT_PHONE}</span>
            </a>
            <a
              href={buildWhatsAppLink({ customMessage: `Hi Atelier, I have a question regarding your ${title}.` })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#128C4A] hover:bg-[#0f753e] min-h-[44px] px-4 py-2 transition-colors"
            >
              Enquire on WhatsApp
            </a>
          </div>
        </div>

        {/* Other policy links navigation */}
        <div className="border-t border-[var(--border)] pt-6">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)] mb-3 font-inter">
            Related Policies
          </p>
          <div className="flex flex-wrap gap-4 text-[13px]">
            {type !== 'privacy' && (
              <Link to="/privacy" className="text-[var(--ink)] hover:text-[var(--gold)] min-h-[44px] inline-flex items-center underline">
                Privacy Policy
              </Link>
            )}
            {type !== 'delivery' && (
              <Link to="/delivery-policy" className="text-[var(--ink)] hover:text-[var(--gold)] min-h-[44px] inline-flex items-center underline">
                Delivery Policy
              </Link>
            )}
            {type !== 'returns-warranty' && (
              <Link to="/returns-warranty" className="text-[var(--ink)] hover:text-[var(--gold)] min-h-[44px] inline-flex items-center underline">
                Returns & Warranty Policy
              </Link>
            )}
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="bg-[var(--bg)] border-t border-[var(--border)] py-8 px-4 sm:px-8 text-center text-[13px] text-[var(--muted)]">
        <p>© {new Date().getFullYear()} ATELIER Fine Furniture. All rights reserved.</p>
      </footer>
    </div>
  )
}
