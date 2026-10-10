import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  reviews as rawReviews,
  GOOGLE_REVIEWS_URL,
  SHOW_DEMO_NOTE,
  validateReviews,
  type Review,
  type ReviewPhoto,
} from '../data/reviews'
import {
  calculateReviewStats,
  formatFullDate,
  formatRelativeDate,
  getAvatarColor,
  getInitials,
} from '../lib/reviewsHelper'
import { CONTACT_PHONE } from '../pages/StorefrontPage'

type SortOption = 'recent' | 'highest' | 'lowest'

interface LightboxState {
  isOpen: boolean
  photos: ReviewPhoto[]
  activeIndex: number
  triggerElement: HTMLElement | null
}

export default function CustomerReviews() {
  const { t } = useTranslation()
  const componentId = useId()

  const [reviewsList] = useState<Review[]>(() => validateReviews(rawReviews))
  const [hasIntersected, setHasIntersected] = useState(false)
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [sortOption, setSortOption] = useState<SortOption>('recent')
  const [visibleCount, setVisibleCount] = useState<number>(6)
  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<string>>(new Set())

  // Lightbox modal state
  const [lightbox, setLightbox] = useState<LightboxState>({
    isOpen: false,
    photos: [],
    activeIndex: 0,
    triggerElement: null,
  })

  const sectionRef = useRef<HTMLDivElement>(null)
  const mobileTrackRef = useRef<HTMLDivElement>(null)
  const lightboxModalRef = useRef<HTMLDivElement>(null)

  // Lazy rendering via IntersectionObserver to avoid layout shift
  useEffect(() => {
    if (!sectionRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasIntersected(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px 0px', threshold: 0.05 }
    )
    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  // Body scroll lock & focus trap for lightbox modal
  useEffect(() => {
    if (!lightbox.isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox()
      } else if (e.key === 'ArrowRight') {
        setLightbox((prev) => ({
          ...prev,
          activeIndex: (prev.activeIndex + 1) % prev.photos.length,
        }))
      } else if (e.key === 'ArrowLeft') {
        setLightbox((prev) => ({
          ...prev,
          activeIndex: (prev.activeIndex - 1 + prev.photos.length) % prev.photos.length,
        }))
      } else if (e.key === 'Tab' && lightboxModalRef.current) {
        const focusable = lightboxModalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [lightbox.isOpen])

  const openLightbox = (photos: ReviewPhoto[], index: number, e: React.MouseEvent<HTMLElement>) => {
    setLightbox({
      isOpen: true,
      photos,
      activeIndex: index,
      triggerElement: e.currentTarget,
    })
  }

  const closeLightbox = () => {
    const trigger = lightbox.triggerElement
    setLightbox({
      isOpen: false,
      photos: [],
      activeIndex: 0,
      triggerElement: null,
    })
    trigger?.focus()
  }

  // Filter & Sort reviews
  const filteredAndSortedReviews = useMemo(() => {
    let list = [...reviewsList]

    // Filter by rating if selected
    if (selectedRating !== null) {
      list = list.filter((r) => r.rating === selectedRating)
    }

    // Sort
    switch (sortOption) {
      case 'highest':
        list.sort((a, b) => b.rating - a.rating || new Date(b.date).getTime() - new Date(a.date).getTime())
        break
      case 'lowest':
        list.sort((a, b) => a.rating - b.rating || new Date(b.date).getTime() - new Date(a.date).getTime())
        break
      case 'recent':
      default:
        list.sort((a, b) => {
          // Featured reviews pin first only under Most recent
          if (a.featured && !b.featured) return -1
          if (!a.featured && b.featured) return 1
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        })
        break
    }

    return list
  }, [reviewsList, selectedRating, sortOption])

  const stats = useMemo(() => calculateReviewStats(reviewsList), [reviewsList])
  const displayedReviews = useMemo(
    () => filteredAndSortedReviews.slice(0, visibleCount),
    [filteredAndSortedReviews, visibleCount]
  )

  const hasDemoEntries = useMemo(() => reviewsList.some((r) => r.demo), [reviewsList])

  const toggleExpand = (id: string) => {
    setExpandedReviewIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleMobileScroll = (direction: 'left' | 'right') => {
    if (!mobileTrackRef.current) return
    const scrollAmount = 320
    mobileTrackRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  // WhatsApp review sharing link for empty state only
  const whatsappFeedbackLink = useMemo(() => {
    const rawNumber = CONTACT_PHONE.replace(/[^0-9]/g, '')
    const message = "Hi Atelier, I'd like to share feedback about my recent furniture purchase."
    return `https://wa.me/${rawNumber}?text=${encodeURIComponent(message)}`
  }, [])

  // Render SVG Stars with half-star clipPath for exact decimal rendering
  const renderStars = (rating: number, size = 16, idPrefix = 'star') => {
    return (
      <div className="flex items-center gap-1" role="img" aria-label={`Rated ${rating} out of 5`}>
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const fillRatio = Math.max(0, Math.min(1, rating - (starIndex - 1)))
          const clipId = `${componentId}-${idPrefix}-${starIndex}`

          return (
            <svg
              key={starIndex}
              width={size}
              height={size}
              viewBox="0 0 24 24"
              className="shrink-0 text-[var(--gold-fill)]"
              aria-hidden="true"
            >
              {fillRatio > 0 && fillRatio < 1 ? (
                <>
                  <defs>
                    <clipPath id={clipId}>
                      <rect x="0" y="0" width={`${fillRatio * 24}`} height="24" />
                    </clipPath>
                  </defs>
                  <path
                    fill="var(--track)"
                    d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                  />
                  <path
                    fill="var(--gold-fill)"
                    clipPath={`url(#${clipId})`}
                    d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                  />
                </>
              ) : fillRatio >= 1 ? (
                <path
                  fill="var(--gold-fill)"
                  d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                />
              ) : (
                <path
                  fill="var(--track)"
                  d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                />
              )}
            </svg>
          )
        })}
      </div>
    )
  }

  return (
    <div ref={sectionRef} className="mt-16 sm:mt-20 pt-16 border-t border-[var(--border)]">
      {/* Section Header */}
      <div className="text-center mb-10 sm:mb-12">
        <span className="text-[13px] font-semibold tracking-[0.18em] uppercase text-[var(--gold)] font-inter block mb-3">
          {t('reviews.eyebrow', 'CUSTOMER STORIES')}
        </span>
        <h2 className="font-fraunces text-[clamp(28px,4vw,40px)] font-normal text-[var(--ink)] leading-tight">
          {t('reviews.title', 'What our customers say')}
        </h2>
        {SHOW_DEMO_NOTE && hasDemoEntries && (
          <p className="text-[13px] text-[var(--muted)] font-inter italic text-center mt-2.5">
            Sample reviews for demonstration
          </p>
        )}
      </div>

      {!hasIntersected ? (
        // Skeleton loader before viewport intersection
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 animate-pulse">
          <div className="md:col-span-4 h-64 bg-white/60 rounded-xl border border-[var(--border)]" />
          <div className="md:col-span-8 space-y-4">
            <div className="h-44 bg-white/60 rounded-xl border border-[var(--border)]" />
            <div className="h-44 bg-white/60 rounded-xl border border-[var(--border)]" />
          </div>
        </div>
      ) : reviewsList.length === 0 ? (
        // EMPTY STATE (Only rendered when reviews array is empty)
        <div className="max-w-xl mx-auto rounded-2xl border border-[var(--border)] bg-white p-8 sm:p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--gold)] flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v7.018z" />
            </svg>
          </div>
          <h3 className="font-fraunces text-xl sm:text-2xl text-[var(--ink)] mb-3">
            {t('reviews.emptyTitle', 'Reviews from our customers will appear here')}
          </h3>
          <p className="text-sm sm:text-base text-[var(--muted)] font-inter leading-relaxed mb-8">
            {t('reviews.emptyBody', 'We invite every customer to share their experience after delivery and publish what we receive with their permission.')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={whatsappFeedbackLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--ink)] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[var(--gold)] transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.072.043.419-.101.824z" />
              </svg>
              <span>{t('reviews.emptyCta', 'Shopped with us? Share your experience')}</span>
            </a>

            {GOOGLE_REVIEWS_URL && (
              <a
                href={GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-full border border-[var(--border)] bg-white text-xs font-semibold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--gold)] transition-colors"
              >
                <span>{t('reviews.googleReviews', 'See all reviews on Google')}</span>
                <svg className="w-3.5 h-3.5 ml-1.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            )}
          </div>
        </div>
      ) : (
        // FILLED REVIEWS SECTION (12-COL DESKTOP & SNAP SCROLL MOBILE)
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* SUMMARY CARD (4 COLS) */}
          <div className="md:col-span-4 md:sticky md:top-[100px]">
            <div className="rounded-xl border border-[var(--border)] bg-white p-7 shadow-sm">
              {stats.totalCount >= 3 ? (
                <>
                  {/* Aggregate Average Score (e.g. 4.4) */}
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-fraunces text-[48px] font-light leading-none text-[var(--ink)]">
                      {stats.formattedAverage}
                    </span>
                    <span className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">/ 5.0</span>
                  </div>

                  {/* 5 SVG Stars */}
                  <div className="mb-2">{renderStars(stats.averageRating, 20, 'summary-avg')}</div>

                  <p className="text-sm text-[var(--muted)] font-inter mb-6">
                    {`Based on ${stats.totalCount} reviews`}
                  </p>

                  {/* Distribution Bars 5..1 */}
                  <div className="space-y-2.5 pt-4 border-t border-[var(--border)] mb-6">
                    {([5, 4, 3, 2, 1] as const).map((star) => {
                      const row = stats.distribution[star]
                      const isRowActive = selectedRating === star

                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSelectedRating(isRowActive ? null : star)}
                          aria-pressed={isRowActive}
                          className={`w-full group flex items-center gap-3 text-xs font-semibold font-inter py-1 px-2 rounded-md transition-colors cursor-pointer ${
                            isRowActive ? 'bg-[var(--bg)] text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                          }`}
                        >
                          <span className="w-7 text-left shrink-0">{star} ★</span>
                          <div className="flex-grow h-2 rounded-full bg-[var(--track)] overflow-hidden">
                            <div
                              className="h-full bg-[var(--gold-fill)] rounded-full transition-all duration-500"
                              style={{ width: `${row.percentage}%` }}
                            />
                          </div>
                          <span className="w-6 text-right shrink-0 text-[11px] tabular-nums text-[var(--muted)]">
                            {row.count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedRating !== null && (
                    <button
                      type="button"
                      onClick={() => setSelectedRating(null)}
                      className="text-xs font-semibold uppercase tracking-wider text-[var(--gold)] hover:text-[var(--ink)] underline mb-4 block cursor-pointer"
                    >
                      {t('reviews.clearFilter', 'Clear filter')}
                    </button>
                  )}
                </>
              ) : (
                // N = 1 or 2 minimal summary (no aggregate score)
                <div className="mb-6">
                  <h3 className="font-fraunces text-2xl text-[var(--ink)] mb-2">
                    {`${stats.totalCount} ${stats.totalCount === 1 ? 'review' : 'reviews'}`}
                  </h3>
                  <p className="text-xs text-[var(--muted)] font-inter mb-4">
                    {t('reviews.trustLine', "Shared with permission. We don't edit customer reviews.")}
                  </p>
                </div>
              )}

              {/* Optional Google Reviews Link */}
              {GOOGLE_REVIEWS_URL && (
                <a
                  href={GOOGLE_REVIEWS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-[var(--border)] text-xs font-semibold uppercase tracking-wider text-[var(--ink)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors mb-4"
                >
                  <span>{t('reviews.googleReviews', 'See all reviews on Google')}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </a>
              )}

              {/* Trust Line Guarantee */}
              <p className="text-[12px] leading-relaxed text-[var(--muted)] font-inter pt-4 border-t border-[var(--border)]">
                {t('reviews.trustLine', "Shared with permission. We don't edit customer reviews.")}
              </p>
            </div>
          </div>

          {/* REVIEWS LIST & CONTROLS (8 COLS) */}
          <div className="md:col-span-8 space-y-6">
            {/* Toolbar Controls (Rendered when N >= 4) */}
            {reviewsList.length >= 4 && (
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] font-inter" aria-live="polite">
                  {filteredAndSortedReviews.length} {filteredAndSortedReviews.length === 1 ? 'review' : 'reviews'}
                </span>

                <div className="flex items-center gap-2">
                  <label htmlFor="reviews-sort" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] sr-only sm:not-sr-only font-inter">
                    {t('reviews.sortLabel', 'Sort reviews:')}
                  </label>
                  <div className="relative">
                    <select
                      id="reviews-sort"
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as SortOption)}
                      className="appearance-none bg-white text-[var(--ink)] text-xs font-semibold uppercase tracking-wider pl-3 pr-8 py-2 rounded-full border border-[var(--border)] hover:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)] cursor-pointer min-h-[40px] shadow-sm transition-colors"
                    >
                      <option value="recent">{t('reviews.sortRecent', 'Most recent')}</option>
                      <option value="highest">{t('reviews.sortHighest', 'Highest rated')}</option>
                      <option value="lowest">{t('reviews.sortLowest', 'Lowest rated')}</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[var(--muted)]">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {filteredAndSortedReviews.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-center">
                <p className="font-fraunces text-xl text-[var(--ink)] mb-2">
                  {t('reviews.noMatchTitle', 'No reviews with this rating yet')}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedRating(null)}
                  className="mt-4 inline-flex items-center justify-center min-h-[44px] px-6 py-2 rounded-full bg-[var(--ink)] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[var(--gold)] transition-colors cursor-pointer"
                >
                  {t('reviews.clearFilter', 'Clear filter')}
                </button>
              </div>
            ) : (
              <>
                {/* Desktop vertical list / Mobile horizontal snap track */}
                <div
                  ref={mobileTrackRef}
                  className="flex md:flex-col gap-6 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory pb-4 md:pb-0 [scrollbar-width:none]"
                >
                  {displayedReviews.map((review) => {
                    const isExpanded = expandedReviewIds.has(review.id)
                    const isLongText = review.body.length > 280
                    const avatarColor = getAvatarColor(review.id || review.name)
                    const initials = getInitials(review.name)

                    return (
                      <article
                        key={review.id}
                        className="snap-start shrink-0 w-[85%] md:w-full rounded-xl border border-[var(--border)] bg-white p-6 transition-shadow duration-300 hover:shadow-[0_6px_24px_rgba(42,33,24,0.06)] flex flex-col justify-between"
                      >
                        <div>
                          {/* Header: Avatar, Name & Area */}
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold tracking-wider font-inter shrink-0 shadow-xs"
                                style={{ backgroundColor: avatarColor }}
                                aria-hidden="true"
                              >
                                {initials}
                              </div>
                              <div>
                                <h3 className="font-inter text-base font-semibold text-[var(--ink)] leading-snug">
                                  {review.name}
                                </h3>
                                {review.area && (
                                  <p className="text-[13px] text-[var(--muted)] font-inter">{review.area}</p>
                                )}
                              </div>
                            </div>

                            {/* Verification/Source Badges (Rendered ONLY when not a demo review) */}
                            {!review.demo && (
                              <div className="flex flex-wrap items-center gap-2 justify-end">
                                {review.verified && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold font-inter bg-[var(--verified-bg)] text-[var(--verified-fg)]">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    <span>{t('reviews.verifiedPurchase', 'Verified purchase')}</span>
                                  </span>
                                )}

                                {review.source === 'google' && review.sourceUrl && (
                                  <a
                                    href={review.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold font-inter bg-[var(--bg)] text-[var(--ink)] hover:text-[var(--gold)] border border-[var(--border)] transition-colors"
                                  >
                                    <span>{t('reviews.googleReview', 'Google review')}</span>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                    </svg>
                                  </a>
                                )}

                                {review.source === 'whatsapp' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold font-inter bg-[#E7F7ED] text-[#1D7740]">
                                    <span>{t('reviews.whatsappFeedback', 'WhatsApp feedback')}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Meta Row: Rating Stars, Relative Date, Product Name */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)] font-inter mb-4">
                            {renderStars(review.rating, 16, `card-${review.id}`)}
                            <span aria-hidden="true">•</span>
                            <time
                              dateTime={review.date}
                              title={formatFullDate(review.date)}
                              className="font-medium cursor-help"
                            >
                              {formatRelativeDate(review.date)}
                            </time>

                            {review.productName && (
                              <>
                                <span aria-hidden="true">•</span>
                                <span className="font-semibold text-[var(--muted)]">{review.productName}</span>
                              </>
                            )}
                          </div>

                          {/* Optional Review Title */}
                          {review.title && (
                            <h4 className="font-fraunces text-base sm:text-lg font-semibold text-[var(--ink)] mb-2">
                              {review.title}
                            </h4>
                          )}

                          {/* Verbatim Body with Line Clamp */}
                          <p
                            className={`font-inter text-[15px] leading-[1.65] text-[var(--ink)] ${
                              !isExpanded && isLongText ? 'line-clamp-5' : ''
                            }`}
                          >
                            {review.body}
                          </p>

                          {isLongText && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(review.id)}
                              aria-expanded={isExpanded}
                              className="mt-2 text-xs font-semibold uppercase tracking-wider text-[var(--gold)] hover:text-[var(--ink)] transition-colors min-h-[36px] flex items-center cursor-pointer"
                            >
                              {isExpanded ? t('reviews.readLess', 'Read less') : t('reviews.readMore', 'Read more')}
                            </button>
                          )}

                          {/* Photos Thumbnail Strip */}
                          {review.photos && review.photos.length > 0 && (
                            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--border)]">
                              {review.photos.map((photo, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={(e) => openLightbox(review.photos!, pIdx, e)}
                                  aria-label={`Open photo ${pIdx + 1}: ${photo.alt}`}
                                  className="group relative w-[72px] h-[72px] rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] shrink-0"
                                >
                                  <img
                                    src={photo.src}
                                    alt={photo.alt}
                                    loading="lazy"
                                    width={72}
                                    height={72}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Owner Reply Block */}
                        {review.ownerReply && (
                          <div className="mt-5 rounded-lg bg-[var(--bg)] border-l-[3px] border-l-[var(--gold-fill)] p-4 text-left">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[13px] font-semibold font-inter text-[var(--ink)]">
                                {t('reviews.ownerReply', 'Reply from Atelier')}
                              </span>
                              <time
                                dateTime={review.ownerReply.date}
                                title={formatFullDate(review.ownerReply.date)}
                                className="text-[11px] text-[var(--muted)] font-inter"
                              >
                                {formatRelativeDate(review.ownerReply.date)}
                              </time>
                            </div>
                            <p className="text-sm font-inter text-[var(--ink)] leading-relaxed">
                              {review.ownerReply.text}
                            </p>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>

                {/* Mobile Scroll Controls */}
                <div className="flex md:hidden items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleMobileScroll('left')}
                    aria-label="Previous review"
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-[var(--border)] bg-white text-[var(--ink)] flex items-center justify-center shadow-xs cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMobileScroll('right')}
                    aria-label="Next review"
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-[var(--border)] bg-white text-[var(--ink)] flex items-center justify-center shadow-xs cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Pagination: "Show more" button */}
                {visibleCount < filteredAndSortedReviews.length && (
                  <div className="text-center pt-6">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 6)}
                      className="inline-flex items-center justify-center min-h-[44px] px-8 py-2.5 rounded-full border border-[var(--border)] bg-white text-xs font-semibold uppercase tracking-wider text-[var(--ink)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors shadow-xs cursor-pointer"
                    >
                      {t('reviews.showMore', 'Show more reviews')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {lightbox.isOpen && (
        <div
          ref={lightboxModalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Customer photo viewer"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs animate-fadeIn"
          onClick={closeLightbox}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={closeLightbox}
              aria-label={t('reviews.closeLightbox', 'Close photo viewer')}
              className="absolute -top-12 right-0 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white/20 text-white hover:bg-white hover:text-black flex items-center justify-center transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Main Lightbox Image */}
            <div className="overflow-hidden rounded-lg bg-black flex items-center justify-center">
              <img
                src={lightbox.photos[lightbox.activeIndex]?.src}
                alt={lightbox.photos[lightbox.activeIndex]?.alt || 'Customer photo'}
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>

            {/* Lightbox Caption */}
            {lightbox.photos[lightbox.activeIndex]?.alt && (
              <p className="mt-3 text-sm text-white/90 text-center font-inter max-w-lg">
                {lightbox.photos[lightbox.activeIndex].alt}
              </p>
            )}

            {/* Navigation Arrows */}
            {lightbox.photos.length > 1 && (
              <div className="flex items-center gap-4 mt-4">
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((prev) => ({
                      ...prev,
                      activeIndex: (prev.activeIndex - 1 + prev.photos.length) % prev.photos.length,
                    }))
                  }
                  aria-label={t('reviews.prevPhoto', 'Previous photo')}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white/20 text-white hover:bg-white hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-white/80 font-inter tabular-nums">
                  {lightbox.activeIndex + 1} / {lightbox.photos.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((prev) => ({
                      ...prev,
                      activeIndex: (prev.activeIndex + 1) % prev.photos.length,
                    }))
                  }
                  aria-label={t('reviews.nextPhoto', 'Next photo')}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white/20 text-white hover:bg-white hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
