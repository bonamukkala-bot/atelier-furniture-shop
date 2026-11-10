import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CONTACT_PHONE } from './StorefrontPage'
import { SHOP_INFO } from '../lib/constants'
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

// Contact details used across the policy
const CONTACT_EMAIL = 'bonamukkalacharan@gmail.com'
const SHOWROOM_ADDRESS = SHOP_INFO.address
const WORKSHOP_ADDRESS = 'Atelier Fine Furniture Workshop, Hyderabad'
const LAST_UPDATED = 'November 10, 2026'

function PrivacyPolicyContent() {
  return (
    <article className="space-y-12">
      {/* Overview introduction */}
      <div className="bg-[#FAF7F2] border border-[var(--border)] p-6 sm:p-8">
        <p className="text-base sm:text-lg text-[var(--ink)] leading-relaxed font-serif italic mb-4">
          "At Atelier Fine Furniture, we value simplicity, honesty, and enduring craft—both in the joinery of our furniture and in how we treat the people who welcome our pieces into their homes."
        </p>
        <p className="text-sm sm:text-[15px] text-[var(--muted)] leading-relaxed">
          This Privacy Policy explains plainly and honestly what personal data we collect when you browse our site, place an order, or reach out to us, why we collect it, how it is handled, and how you can access, update, or remove your data. We do not sell your data or bury our practices behind legal jargon.
        </p>
      </div>

      {/* Section 1: Who We Are */}
      <section aria-labelledby="section-who-we-are" className="scroll-mt-24">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-6 h-6 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] flex items-center justify-center text-xs font-semibold font-mono">
            1
          </span>
          <h2 id="section-who-we-are" className="font-fraunces text-2xl sm:text-3xl text-[var(--ink)] font-normal">
            Who We Are
          </h2>
        </div>
        <div className="text-sm sm:text-[15px] text-[var(--muted)] leading-relaxed space-y-4">
          <p>
            We are <strong className="text-[var(--ink)] font-semibold">Atelier Fine Furniture</strong>, an artisanal studio and woodworking workshop based in Hyderabad, Telangana. We design, handcraft, and deliver solid timber furniture directly to customers across Hyderabad and surrounding areas.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-white border border-[var(--border)]">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-[var(--gold)] mb-1.5 font-inter">
                Showroom Location
              </h3>
              <p className="text-sm text-[var(--ink)] leading-snug">
                {SHOWROOM_ADDRESS}
              </p>
            </div>
            <div className="p-4 bg-white border border-[var(--border)]">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-[var(--gold)] mb-1.5 font-inter">
                Woodworking Workshop
              </h3>
              <p className="text-sm text-[var(--ink)] leading-snug">
                {WORKSHOP_ADDRESS}
              </p>
            </div>
            <div className="p-4 bg-white border border-[var(--border)]">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-[var(--gold)] mb-1.5 font-inter">
                Phone & WhatsApp
              </h3>
              <p className="text-sm text-[var(--ink)] leading-snug font-mono">
                {CONTACT_PHONE}
              </p>
            </div>
            <div className="p-4 bg-white border border-[var(--border)]">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-[var(--gold)] mb-1.5 font-inter">
                Direct Email
              </h3>
              <p className="text-sm text-[var(--ink)] leading-snug font-mono">
                {CONTACT_EMAIL}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: What We Collect */}
      <section aria-labelledby="section-what-we-collect" className="scroll-mt-24">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-6 h-6 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] flex items-center justify-center text-xs font-semibold font-mono">
            2
          </span>
          <h2 id="section-what-we-collect" className="font-fraunces text-2xl sm:text-3xl text-[var(--ink)] font-normal">
            What We Collect
          </h2>
        </div>
        <p className="text-sm sm:text-[15px] text-[var(--muted)] leading-relaxed mb-4">
          We collect only what is strictly necessary to create your furniture, fulfill your delivery, and communicate with you:
        </p>
        <ul className="space-y-3 text-sm sm:text-[15px] text-[var(--muted)] leading-relaxed">
          <li className="flex items-start gap-3 p-3 bg-white border border-[var(--border)]">
            <span className="text-[var(--gold)] font-bold text-base leading-none mt-0.5">•</span>
            <div>
              <strong className="text-[var(--ink)] font-semibold">Google Sign-In Information:</strong> When you sign in to view or manage your account or orders using Google Sign-In, we receive your name, email address, and basic Google profile information (such as your account identifier and avatar) provided by Google.
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 bg-white border border-[var(--border)]">
            <span className="text-[var(--gold)] font-bold text-base leading-none mt-0.5">•</span>
            <div>
              <strong className="text-[var(--ink)] font-semibold">Phone Number:</strong> We collect your mobile phone number to coordinate order confirmations, dispatch updates, delivery scheduling, and support.
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 bg-white border border-[var(--border)]">
            <span className="text-[var(--gold)] font-bold text-base leading-none mt-0.5">•</span>
            <div>
              <strong className="text-[var(--ink)] font-semibold">Delivery Address & Map Coordinates:</strong> Your street address, apartment/house number, and landmark. If you interact with our delivery zone checker or address pin selector, we also receive the geographic location coordinates (latitude and longitude) to calculate accurate delivery eligibility and fees.
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 bg-white border border-[var(--border)]">
            <span className="text-[var(--gold)] font-bold text-base leading-none mt-0.5">•</span>
            <div>
              <strong className="text-[var(--ink)] font-semibold">Order Details:</strong> The furniture items you purchase, dimensions, custom timber/finish selections, price and payment status, order tracking tokens, and communication notes.
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 bg-white border border-[var(--border)]">
            <span className="text-[var(--gold)] font-bold text-base leading-none mt-0.5">•</span>
            <div>
              <strong className="text-[var(--ink)] font-semibold">Delivery Photos (Proof of Delivery):</strong> At the time of handover, our delivery partner captures a photo of the assembled/delivered furniture at your location. This acts as visual proof of delivery and records the item's sound physical condition upon arrival.
            </div>
          </li>
        </ul>
      </section>

      {/* Section 3: Why We Collect It */}
      <section aria-labelledby="section-why-we-collect" className="scroll-mt-24">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-6 h-6 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] flex items-center justify-center text-xs font-semibold font-mono">
            3
          </span>
          <h2 id="section-why-we-collect" className="font-fraunces text-2xl sm:text-3xl text-[var(--ink)] font-normal">
            Why We Collect It
          </h2>
        </div>
        <p className="text-sm sm:text-[15px] text-[var(--muted)] leading-relaxed mb-4">
          Every piece of information we collect is directly tied to the craftsmanship and delivery of your furniture:
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">
              Order Processing & Fulfillment
            </h3>
            <p className="text-xs sm:text-[13px] text-[var(--muted)] leading-relaxed">
              To build your furniture according to your chosen specifications, prepare packages, and bring them safely to your address.
            </p>
          </div>
          <div className="p-4 bg-white border border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">
              Order Updates & Delivery Confirmation
            </h3>
            <p className="text-xs sm:text-[13px] text-[var(--muted)] leading-relaxed">
              To send order tracking links and generate the secure delivery confirmation code needed to authorize handover when your furniture arrives.
            </p>
          </div>
          <div className="p-4 bg-white border border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">
              Enquiries & Design Consultations
            </h3>
            <p className="text-xs sm:text-[13px] text-[var(--muted)] leading-relaxed">
              To answer your questions regarding timber species, dimensions, bespoke orders, and showroom appointments via phone, WhatsApp, or website chat.
            </p>
          </div>
          <div className="p-4 bg-white border border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">
              Customer Reviews
            </h3>
            <p className="text-xs sm:text-[13px] text-[var(--muted)] leading-relaxed">
              To invite you to share feedback and review your experience with our pieces after a completed delivery.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: Who Sees It */}
      <section aria-labelledby="section-who-sees-it" className="scroll-mt-24">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-6 h-6 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] flex items-center justify-center text-xs font-semibold font-mono">
            4
          </span>
          <h2 id="section-who-sees-it" className="font-fraunces text-2xl sm:text-3xl text-[var(--ink)] font-normal">
            Who Sees Your Information
          </h2>
        </div>
        <p className="text-sm sm:text-[15px] text-[var(--muted)] leading-relaxed mb-4">
          We strictly restrict who can access your personal data:
        </p>
        <div className="space-y-4 text-sm sm:text-[15px] text-[var(--muted)] leading-relaxed">
          <div className="p-4 bg-white border border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">
              Our Assigned Delivery Partners
            </h3>
            <p className="text-xs sm:text-[13px] text-[var(--muted)] leading-relaxed">
              When an order is dispatched, our designated delivery partner receives <strong className="text-[var(--ink)]">only the customer's name, phone number, and delivery address</strong> for the specific order assigned to them. Delivery partners cannot view other customer records or browse past orders they were not assigned to.
            </p>
          </div>

          <div className="p-4 bg-white border border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">
              Google Services
            </h3>
            <p className="text-xs sm:text-[13px] text-[var(--muted)] leading-relaxed">
              We use Google Sign-In for secure authentication and Google Maps / Places services for geocoding and delivery route estimation. These services operate under Google's respective privacy standards.
            </p>
          </div>

          <div className="p-4 bg-white border border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">
              Cloud Hosting & Database Infrastructure
            </h3>
            <p className="text-xs sm:text-[13px] text-[var(--muted)] leading-relaxed">
              Our site and operational database are hosted on secure, modern cloud infrastructure (Supabase and Vercel) which store application records in encrypted environments.
            </p>
          </div>

          <div className="p-4 bg-[var(--verified-bg)] border border-[#c3dec7] text-[#1b4324]">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <span className="text-base">✓</span> We Do Not Sell Personal Data
            </h3>
            <p className="text-xs sm:text-[13px] leading-relaxed">
              We never sell, rent, monetize, or trade customer contact details or personal information to data brokers, ad networks, or third-party marketing companies.
            </p>
          </div>
        </div>
      </section>

      {/* Section 5: How Long We Keep It & Your Rights */}
      <section aria-labelledby="section-retention-and-rights" className="scroll-mt-24">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-6 h-6 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] flex items-center justify-center text-xs font-semibold font-mono">
            5
          </span>
          <h2 id="section-retention-and-rights" className="font-fraunces text-2xl sm:text-3xl text-[var(--ink)] font-normal">
            Data Retention & Your Rights
          </h2>
        </div>
        <div className="text-sm sm:text-[15px] text-[var(--muted)] leading-relaxed space-y-4">
          <p>
            <strong className="text-[var(--ink)] font-semibold">How long we keep it:</strong> We retain your order history, delivery details, and proof-of-delivery photos only for as long as necessary to complete the delivery, service our multi-year joinery warranties, manage customer care, and satisfy standard financial accounting and tax requirements under Indian law.
          </p>
          <p>
            <strong className="text-[var(--ink)] font-semibold">Viewing, correcting, or deleting your data:</strong> You have the right at any time to:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
            <li>Request a copy of the personal information we hold about you.</li>
            <li>Ask us to correct or update outdated phone numbers, delivery addresses, or contact information.</li>
            <li>Request the deletion of your account and customer details, provided they are not required to fulfill an active in-flight order, preserve warranty records, or satisfy mandatory tax record retention.</li>
          </ul>
          <p>
            To submit any request, simply get in touch with our showroom directly. We do not require complicated ticketing systems—just message or call us directly.
          </p>
        </div>

        {/* Contact Action Card */}
        <div className="mt-6 p-6 bg-white border border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--ink)] mb-1">
              Have a question or request about your data?
            </h3>
            <p className="text-xs sm:text-sm text-[var(--muted)]">
              Contact Atelier Fine Furniture directly via phone, WhatsApp, or email.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <a
              href="tel:+919014996929"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--ink)] hover:text-[var(--gold)] min-h-[44px] px-4 py-2 border border-[var(--border)] transition-colors"
            >
              <span>Call: {CONTACT_PHONE}</span>
            </a>
            <a
              href={buildWhatsAppLink({ customMessage: 'Hi Atelier, I have a question regarding my privacy and personal data.' })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-[#128C4A] hover:bg-[#0f753e] min-h-[44px] px-4 py-2 transition-colors"
            >
              WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      {/* Section 6: Plain & Honest Commitment */}
      <section aria-labelledby="section-honest-commitment" className="scroll-mt-24 border-t border-[var(--border)] pt-8">
        <h2 id="section-honest-commitment" className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--gold)] mb-2 font-inter">
          Honest Digital Practice
        </h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          Our website is built to present our furniture collection and facilitate transparent, reliable ordering. We do not run third-party advertising scripts, behavioral tracking cookies, or covert tracking pixels. When you browse our collection, your visit is private.
        </p>
      </section>
    </article>
  )
}

function PlaceholderPolicyContent({ title, type }: { title: string; type: PolicyType }) {
  return (
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
            Policy Document Status: Formalized Terms in Preparation
          </h2>
          <p className="text-[13px] text-[var(--muted)] leading-relaxed mb-4">
            The detailed operational guidelines for this {type === 'delivery' ? 'delivery policy' : 'warranty and returns policy'} are maintained directly by the Atelier showroom team.
          </p>
          <p className="text-[13px] text-[var(--muted)] leading-relaxed">
            For immediate queries regarding dispatch timeframes, wood guarantees, or return protocols, please connect with our showroom team:
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
  )
}

export default function PolicyPage({ type }: PolicyPageProps) {
  const { t } = useTranslation()
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
      <main id="main-content" className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 w-full">
        {/* Breadcrumb Navigation */}
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

        {/* Page Title & Last Updated */}
        <header className="mb-10 border-b border-[var(--border)] pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <span className="text-[13px] font-semibold tracking-[0.18em] uppercase text-[var(--gold)] mb-2 block font-inter">
                Legal & Customer Care
              </span>
              <h1 className="font-fraunces text-3xl sm:text-4xl text-[var(--ink)] font-normal">
                {title}
              </h1>
            </div>
            {type === 'privacy' && (
              <span className="text-xs text-[var(--muted)] font-mono">
                Last updated: {LAST_UPDATED}
              </span>
            )}
          </div>
        </header>

        {/* Content Body */}
        {type === 'privacy' ? (
          <PrivacyPolicyContent />
        ) : (
          <PlaceholderPolicyContent title={title} type={type} />
        )}

        {/* Other policy links navigation */}
        <div className="border-t border-[var(--border)] pt-8 mt-12">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)] mb-3 font-inter">
            Related Policies & Direct Links
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

      {/* Site Footer */}
      <footer className="bg-[var(--bg)] border-t border-[var(--border)] py-10 px-4 sm:px-8 text-[13px] text-[var(--muted)]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex flex-col items-center sm:items-start">
            <span className="font-fraunces text-base font-semibold text-[var(--ink)]">ATELIER</span>
            <span className="text-[10px] font-semibold tracking-[0.2em] text-[var(--gold)] uppercase">Fine Furniture · Hyderabad</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/" className="hover:text-[var(--gold)] transition-colors min-h-[44px] inline-flex items-center">
              Home
            </Link>
            <span aria-hidden="true" className="text-[var(--border)]">·</span>
            <Link to="/privacy" className={`hover:text-[var(--gold)] transition-colors min-h-[44px] inline-flex items-center ${type === 'privacy' ? 'text-[var(--gold)] font-medium' : ''}`}>
              Privacy Policy
            </Link>
            <span aria-hidden="true" className="text-[var(--border)]">·</span>
            <Link to="/delivery-policy" className={`hover:text-[var(--gold)] transition-colors min-h-[44px] inline-flex items-center ${type === 'delivery' ? 'text-[var(--gold)] font-medium' : ''}`}>
              Delivery Policy
            </Link>
            <span aria-hidden="true" className="text-[var(--border)]">·</span>
            <Link to="/returns-warranty" className={`hover:text-[var(--gold)] transition-colors min-h-[44px] inline-flex items-center ${type === 'returns-warranty' ? 'text-[var(--gold)] font-medium' : ''}`}>
              Returns & Warranty
            </Link>
          </div>
          <p className="text-xs uppercase tracking-wider">
            © {new Date().getFullYear()} ATELIER. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
