import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import type { Product } from '../lib/types'
import { getOptimizedImageUrl } from '../lib/imageOptimization'
import { SHOP_INFO } from '../lib/constants'
import FloatingContactControl from '../components/FloatingContactControl'
import ProductQuickActions from '../components/ProductQuickActions'
import LanguageToggle from '../components/LanguageToggle'
import CustomerAccountControl from '../components/CustomerAccountControl'
import CustomerReviews from '../components/CustomerReviews'
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  useMotionTemplate,
  useReducedMotion,
  AnimatePresence,
} from 'framer-motion'

// Text constant for the contact number
export const CONTACT_PHONE = "+91 90149 96929"

// Hero video assets
const HERO_VIDEO_SRC = '/hero-video.mp4'
const HERO_POSTER_SRC = '/hero-poster.png'

// Helper function to normalize category casing (trimmed and title-cased)
function formatCategoryName(name: string): string {
  if (!name) return ''
  const trimmed = name.trim()
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function getCategoryDisplayName(category: string, t: (key: string) => string): string {
  const normalizedCategory = category?.trim()
  if (!normalizedCategory) return ''
  const keyMap: Record<string, string> = {
    'Sofa / Recliner': 'categories.sofaRecliner',
    'Dining Table Set': 'categories.diningTableSet',
    'TV Unit': 'categories.tvUnit',
    Bed: 'categories.bed',
    Chair: 'categories.chair',
  }
  return keyMap[normalizedCategory] ? t(keyMap[normalizedCategory]) : formatCategoryName(normalizedCategory)
}

// Helper function to format prices for Indian numbering system (e.g. ₹12,999)
function formatPrice(price: number): string {
  return Math.round(Number(price)).toLocaleString('en-IN')
}

// SVG for the all-categories navigation item
const ALL_ICON = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

interface CategoryPreview {
  name: string
  imageUrl: string
}

// 3D Tilting Product Card Component
interface ProductCardProps {
  product: Product
  allImages: Record<string, string[]>
}

function ProductCard({ product, allImages }: ProductCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const images = allImages[product.id] || (product.image_url ? [product.image_url] : [])
  const shouldReduceMotion = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Auto-advance effect
  useEffect(() => {
    if (images.length <= 1 || isPaused) return

    const interval = setInterval(() => {
      setDirection(1)
      setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
    }, 3000)

    return () => clearInterval(interval)
  }, [images.length, isPaused])

  // Pause on hover/touch
  const handleCarouselPause = () => setIsPaused(true)
  const handleTouchStart = () => setIsPaused(true)
  const handleTouchEnd = () => {
    setTimeout(() => setIsPaused(false), 2000)
  }

  // Spring configurations for 3D tilt
  const springConfig = { damping: 25, stiffness: 200, mass: 0.5 }
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), springConfig)
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), springConfig)

  // Motion templates for the glossy shine
  const percentX = useTransform(x, [-0.5, 0.5], [0, 100])
  const percentY = useTransform(y, [-0.5, 0.5], [0, 100])
  const shineBg = useMotionTemplate`radial-gradient(circle at ${percentX}% ${percentY}%, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 65%)`

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left - rect.width / 2
    const mouseY = e.clientY - rect.top - rect.height / 2
    x.set(mouseX / rect.width)
    y.set(mouseY / rect.height)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
    // Resume auto-advance after a short delay
    setTimeout(() => setIsPaused(false), 2000)
  }

  // Fade-in-and-rise variant
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.45,
      },
    },
  }

  const hasDiscount = Boolean(product.compare_at_price && product.compare_at_price > product.price)
  const discountPercent = hasDiscount
    ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100)
    : 0
  const showDiscount = hasDiscount && discountPercent > 0

  const createdAt = new Date(product.created_at).getTime()
  const isNewArrival = !product.sold && Number.isFinite(createdAt) && createdAt >= Date.now() - 14 * 24 * 60 * 60 * 1000 && createdAt <= Date.now()

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      setDirection(-1)
      setImageLoaded(false)
      setImageError(false)
      setCurrentImageIndex((prev) => prev - 1)
      // Reset auto-advance timer
      setIsPaused(true)
      setTimeout(() => setIsPaused(false), 2000)
    }
  }

  const stopCardNavigation = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
  }

  const handleNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setDirection(1)
      setImageLoaded(false)
      setImageError(false)
      setCurrentImageIndex((prev) => prev + 1)
      // Reset auto-advance timer
      setIsPaused(true)
      setTimeout(() => setIsPaused(false), 2000)
    }
  }

  const handleDotClick = (idx: number) => {
    setDirection(idx > currentImageIndex ? 1 : -1)
    setImageLoaded(false)
    setImageError(false)
    setCurrentImageIndex(idx)
    // Reset auto-advance timer
    setIsPaused(true)
    setTimeout(() => setIsPaused(false), 2000)
  }

  const currentImageUrl = images[currentImageIndex] || product.image_url

  // Swipe gesture handlers
  const handleDragEnd = (_e: unknown, { offset, velocity }: { offset: { x: number }; velocity: { x: number } }) => {
    const swipe = swipePower(offset.x, velocity.x)
    if (swipe < -10000 && currentImageIndex < images.length - 1) {
      setDirection(1)
      setImageLoaded(false)
      setImageError(false)
      setCurrentImageIndex((prev) => prev + 1)
      setIsPaused(true)
      setTimeout(() => setIsPaused(false), 2000)
    } else if (swipe > 10000 && currentImageIndex > 0) {
      setDirection(-1)
      setImageLoaded(false)
      setImageError(false)
      setCurrentImageIndex((prev) => prev - 1)
      setIsPaused(true)
      setTimeout(() => setIsPaused(false), 2000)
    }
  }

  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity
  }

  // Slide animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 30,
      },
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 30,
      },
    }),
  }

  const categoryEyebrow = (product.category && getCategoryDisplayName(product.category, t)) || 'FURNITURE'

  return (
    <motion.div
      variants={cardVariants}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleCarouselPause}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      whileHover="hover"
      onClick={() => navigate(`/product/${product.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          navigate(`/product/${product.id}`)
        }
      }}
      role="link"
      tabIndex={0}
      style={{
        rotateX: shouldReduceMotion ? 0 : rotateX,
        rotateY: shouldReduceMotion ? 0 : rotateY,
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      className="group relative bg-[var(--bg)] rounded-none border border-[var(--border)] overflow-hidden transition-shadow duration-300 hover:shadow-2xl flex flex-col h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
    >
      {/* 1:1 Aspect Ratio Image Container */}
      <div className="relative w-full aspect-square bg-[#F5EFEB] overflow-hidden border-b border-[var(--border)]">
        {/* Skeleton shimmer before image loads */}
        {!imageLoaded && !imageError && currentImageUrl && (
          <div className={`absolute inset-0 bg-[#EFE9DE] ${!shouldReduceMotion ? 'skeleton-shimmer' : ''}`} />
        )}

        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentImageIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            drag={shouldReduceMotion ? false : images.length > 1 ? 'x' : false}
            dragConstraints={shouldReduceMotion ? undefined : { left: 0, right: 0 }}
            dragElastic={shouldReduceMotion ? 0 : 0.2}
            onDragEnd={handleDragEnd}
            className="absolute inset-0"
          >
            {currentImageUrl && !imageError ? (
              <img
                key={currentImageUrl}
                src={getOptimizedImageUrl(currentImageUrl, 800, 80)}
                alt={product.name}
                width={400}
                height={400}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-[var(--bg)] flex flex-col items-center justify-center text-[var(--muted)] p-4 text-center">
                <svg className="w-8 h-8 mb-2 opacity-50 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span className="font-inter text-xs">No image available</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Carousel controls render ONLY when images.length > 1 */}
        {images.length > 1 && (
          <>
            {/* Left arrow */}
            <button
              type="button"
              aria-label="Previous image"
              onClick={(event) => {
                stopCardNavigation(event)
                handlePrevImage()
              }}
              disabled={currentImageIndex === 0}
              className={`absolute left-2 top-1/2 -translate-y-1/2 w-[44px] h-[44px] min-w-[44px] min-h-[44px] bg-white/90 hover:bg-white text-[var(--ink)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] transition-opacity duration-200 shadow-md z-30 ${
                currentImageIndex === 0 ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Right arrow */}
            <button
              type="button"
              aria-label="Next image"
              onClick={(event) => {
                stopCardNavigation(event)
                handleNextImage()
              }}
              disabled={currentImageIndex === images.length - 1}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-[44px] h-[44px] min-w-[44px] min-h-[44px] bg-white/90 hover:bg-white text-[var(--ink)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] transition-opacity duration-200 shadow-md z-30 ${
                currentImageIndex === images.length - 1 ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Image count indicator */}
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-inter pointer-events-none z-20">
              {currentImageIndex + 1}/{images.length}
            </div>

            {/* Dot indicators */}
            <div className="absolute bottom-2 left-2 flex gap-1.5 z-20">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Show image ${idx + 1}`}
                  aria-pressed={idx === currentImageIndex}
                  onClick={(event) => {
                    stopCardNavigation(event)
                    handleDotClick(idx)
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    idx === currentImageIndex ? 'bg-white shadow-sm' : 'bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* 3D Glossy Shine Effect Overlay */}
        {!shouldReduceMotion && (
          <motion.div
            style={{ background: shineBg }}
            className="absolute inset-0 pointer-events-none z-20 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
        )}

        {/* Top-left corner discount ribbon */}
        {showDiscount && (
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <span className="bg-[var(--gold)] text-white font-inter text-[11px] font-bold tracking-wider uppercase px-2 py-1 rounded-sm shadow-sm">
              -{discountPercent}%
            </span>
          </div>
        )}

        {/* New Arrival Badge */}
        {isNewArrival && (
          <span className="absolute top-3 right-3 z-20 bg-[var(--ink)] text-[var(--bg)] px-2.5 py-1 font-inter text-[10px] font-bold uppercase tracking-wider rounded-sm shadow-sm">
            New Arrival
          </span>
        )}
      </div>

      {/* Info details */}
      <div className="p-5 flex-grow flex flex-col">
        {/* Consistent category eyebrow with fallback */}
        <span className="text-[13px] uppercase tracking-[0.18em] text-[var(--gold)] font-inter font-semibold block mb-1">
          {categoryEyebrow}
        </span>

        {/* Title clamped to 2 lines with reserved min-height for baseline alignment */}
        <h3
          title={product.name}
          className="font-fraunces text-[20px] leading-[1.3] font-normal text-[var(--ink)] mb-2 group-hover:text-[var(--gold)] transition-colors duration-300 line-clamp-2 min-h-[2.6em]"
        >
          {product.name}
        </h3>

        {/* Price Block under title */}
        <div className="flex items-baseline flex-wrap gap-x-2.5 gap-y-1 mb-2">
          <span className="font-inter text-[22px] font-semibold text-[var(--ink)] leading-none">
            ₹{formatPrice(product.price)}
          </span>
          {showDiscount && (
            <>
              <span className="font-inter text-[14px] text-[var(--muted)] line-through leading-none">
                ₹{formatPrice(product.compare_at_price!)}
              </span>
              <span className="font-inter text-[12px] font-semibold bg-[#F3E7D3] text-[#6B4A1C] px-2 py-0.5 rounded-[4px] leading-tight">
                {discountPercent}% OFF
              </span>
            </>
          )}
          <span className="sr-only">
            {showDiscount
              ? `Original price ₹${formatPrice(product.compare_at_price!)}, now ₹${formatPrice(product.price)}`
              : `Price ₹${formatPrice(product.price)}`}
          </span>
        </div>

        {/* Material line */}
        {product.material ? (
          <p className="text-[14px] text-[var(--muted)] font-inter line-clamp-2 min-h-[1.5em] mt-auto pt-2 border-t border-[var(--border)]/60">
            <span className="font-medium text-[var(--ink)]/80">Material:</span> {product.material}
          </p>
        ) : (
          <div className="min-h-[1.5em] mt-auto pt-2" aria-hidden="true" />
        )}
      </div>

      {/* Actions row with margin-top auto for aligned buttons */}
      <div className="border-t border-[var(--border)] px-4 py-3 mt-auto bg-[var(--bg)]">
        <ProductQuickActions product={product} />
      </div>
    </motion.div>
  )
}

interface SectionHeaderProps {
  eyebrow: string
  title: string
  subtitle?: string
  className?: string
}

function SectionHeader({ eyebrow, title, subtitle, className = '' }: SectionHeaderProps) {
  return (
    <div className={`text-center max-w-3xl mx-auto mb-10 sm:mb-12 ${className}`}>
      <span className="text-[13px] font-semibold tracking-[0.18em] uppercase text-[var(--gold)] mb-3 block font-inter">
        {eyebrow}
      </span>
      <h2 className="text-[clamp(28px,4vw,40px)] font-fraunces font-normal text-[var(--ink)] leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-sm sm:text-base text-[var(--muted)] font-inter leading-relaxed max-w-xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  )
}

function SkeletonFeaturedCard({ animate }: { animate: boolean }) {
  return (
    <div className="snap-start flex-shrink-0 w-[280px] sm:w-[320px] md:w-[360px] rounded-lg overflow-hidden border border-[var(--border)] bg-white flex flex-col shadow-sm">
      <div className={`aspect-[4/3] sm:aspect-square bg-[#EFE9DE] ${animate ? 'skeleton-shimmer' : ''}`} />
      <div className="p-5 space-y-3 flex-grow">
        <div className="h-3 w-1/3 rounded-full bg-[#EFE9DE]" />
        <div className="h-5 w-3/4 rounded-full bg-[#EFE9DE]" />
        <div className="h-5 w-1/4 rounded-full bg-[#EFE9DE]" />
      </div>
      <div className="p-5 pt-0">
        <div className="h-4 w-1/3 rounded-full bg-[#EFE9DE]" />
      </div>
    </div>
  )
}

function SkeletonCategoryCircle({ animate }: { animate: boolean }) {
  return (
    <div className="group flex w-[100px] shrink-0 snap-start flex-col items-center md:w-[140px]" aria-hidden="true">
      <div className={`relative flex aspect-square w-[100px] overflow-hidden rounded-full border-2 border-[#E4DDD1] md:w-[140px] ${animate ? 'skeleton-shimmer' : 'bg-[#FBF8F3]'}`} />
      <div className="mt-3 flex min-h-9 flex-col items-center gap-2">
        <div className="h-3 w-16 rounded-full bg-[#FBF8F3]" />
        <div className="h-2 w-10 rounded-full bg-[#FBF8F3]" />
      </div>
    </div>
  )
}

function SkeletonCollectionCard({ animate }: { animate: boolean }) {
  return (
    <div className="bg-[var(--bg)] rounded-none border border-[var(--border)] overflow-hidden flex flex-col h-full">
      <div className={`w-full aspect-square bg-[#EFE9DE] ${animate ? 'skeleton-shimmer' : ''}`} />
      <div className="p-5 space-y-3 flex-grow">
        <div className="h-3 w-1/3 rounded-full bg-[#EFE9DE]" />
        <div className="h-5 w-3/4 rounded-full bg-[#EFE9DE]" />
        <div className="h-6 w-1/2 rounded-full bg-[#EFE9DE]" />
        <div className="h-4 w-1/3 rounded-full bg-[#EFE9DE]" />
      </div>
      <div className="border-t border-[var(--border)] p-4 mt-auto">
        <div className="h-8 w-1/3 ml-auto rounded bg-[#EFE9DE]" />
      </div>
    </div>
  )
}

// Reveal variants shared across the storefront sections.
const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
    },
  },
}

// Scroll reveal variants for sections
const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
    },
  },
}

// Staggered child reveal variants
const childVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
    },
  },
}

// Reveal wrapper for the collection grid. Unlike the old whileInView approach,
// this never depends on an intersection callback firing to reveal content:
//  - primary: a native IntersectionObserver reveals the grid as it scrolls in
//    (threshold 0.1 — reachable on every layout: at 375px the grid is ~4200px
//    tall, so 10% ≈ 420px, which fits in any real viewport),
//  - fallback: a 250ms interval forces the grid visible as soon as it enters
//    the viewport, so even a failed/delayed observer cannot leave it hidden,
//  - reduced-motion users get it visible immediately.
function CollectionRevealGrid({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(shouldReduceMotion)

  useEffect(() => {
    const el = ref.current
    if (!el || shouldReduceMotion || show) return

    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setShow(true)
            io?.disconnect()
          }
        },
        { threshold: 0.1 }
      )
      io.observe(el)
    }

    // Fallback guarantee: if the observer never fires, reveal the grid the
    // moment it enters the viewport. Content can never stay invisible.
    const fallback = window.setInterval(() => {
      if (el.getBoundingClientRect().top < window.innerHeight) {
        setShow(true)
        window.clearInterval(fallback)
      }
    }, 250)

    return () => {
      io?.disconnect()
      window.clearInterval(fallback)
    }
  }, [shouldReduceMotion, show])

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate={show ? 'show' : 'hidden'}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch"
    >
      {children}
    </motion.div>
  )
}

function StorefrontPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryLoading, setCategoryLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedCategory = searchParams.get('category') || 'All'
  const selectedSort = searchParams.get('sort') || 'featured'

  const handleCategoryChange = (cat: string) => {
    const params = new URLSearchParams(searchParams)
    if (!cat || cat === 'All') {
      params.delete('category')
    } else {
      params.set('category', cat)
    }
    setSearchParams(params, { replace: false })
  }

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(searchParams)
    if (!sort || sort === 'featured') {
      params.delete('sort')
    } else {
      params.set('sort', sort)
    }
    setSearchParams(params, { replace: false })
  }

  const handleClearFilters = () => {
    setSearchParams({}, { replace: false })
  }
  const [productImages, setProductImages] = useState<Record<string, string[]>>({})
  const [categoryPreviews, setCategoryPreviews] = useState<CategoryPreview[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mobileMenuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  const handleMobileNavClick = (targetId: string) => {
    setMobileMenuOpen(false)
    document.getElementById(targetId)?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
  }

  const MIN_SKELETON_DURATION_MS = 400
  const waitMinimumSkeleton = async (startedAt: number) => {
    const elapsed = Date.now() - startedAt
    if (elapsed < MIN_SKELETON_DURATION_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_SKELETON_DURATION_MS - elapsed))
    }
  }

  async function fetchCategoryPreviews() {
    const startedAt = Date.now()
    setCategoryLoading(true)

    // This separate query deliberately leaves the catalog's existing product
    // filtering untouched. Ordering first by stock makes the first image kept
    // for each category its best-stocked available product.
    const { data, error: categoryError } = await supabase
      .from('products')
      .select('category, image_url, stock_qty')
      .eq('sold', false)
      .eq('is_archived', false)
      .gt('stock_qty', 0)
      .not('category', 'is', null)
      .not('image_url', 'is', null)
      .order('stock_qty', { ascending: false })

    if (categoryError) {
      setCategoryPreviews([])
      await waitMinimumSkeleton(startedAt)
      setCategoryLoading(false)
      return
    }

    const previewsByCategory = new Map<string, CategoryPreview>()
    data?.forEach((product) => {
      if (!product.category || !product.image_url) return

      const name = formatCategoryName(product.category)
      if (!previewsByCategory.has(name)) {
        previewsByCategory.set(name, { name, imageUrl: product.image_url })
      }
    })

    setCategoryPreviews(Array.from(previewsByCategory.values()))
    await waitMinimumSkeleton(startedAt)
    setCategoryLoading(false)
  }

  const [isScrolled, setIsScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('collection')

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 40)
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const sectionIds = ['collection', 'about-us', 'visit-us']
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }
    )

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchCategoryPreviews()
  }, [])

  async function fetchProducts() {
    const startedAt = Date.now()
    setLoading(true)
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('sold', false)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (productsError) {
      setError(productsError.message)
    } else {
      setProducts(productsData ?? [])

      // Fetch product images
      if (productsData && productsData.length > 0) {
        const productIds = productsData.map(p => p.id)
        const { data: imagesData } = await supabase
          .from('product_images')
          .select('product_id, image_url, sort_order')
          .in('product_id', productIds)
          .order('sort_order', { ascending: true })

        // Group images by product_id
        const imagesMap: Record<string, string[]> = {}
        imagesData?.forEach(img => {
          if (!imagesMap[img.product_id]) {
            imagesMap[img.product_id] = []
          }
          imagesMap[img.product_id].push(img.image_url)
        })
        setProductImages(imagesMap)
      }
    }
    await waitMinimumSkeleton(startedAt)
    setLoading(false)
  }

  const categories = ['All', ...categoryPreviews.map((category) => category.name)]

  // Filter and sort products based on active category and sort query params
  const filteredAndSortedProducts = useMemo(() => {
    const result =
      selectedCategory === 'All'
        ? [...products]
        : products.filter(
            (p) => p.category && formatCategoryName(p.category).toLowerCase() === selectedCategory.toLowerCase()
          )

    switch (selectedSort) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        result.sort((a, b) => b.price - a.price)
        break
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'featured':
      default:
        result.sort((a, b) => {
          if (a.featured && !b.featured) return -1
          if (!a.featured && b.featured) return 1
          return 0
        })
        break
    }
    return result
  }, [products, selectedCategory, selectedSort])

  const shouldReduceMotion = useReducedMotion()
  const featuredTrackRef = useRef<HTMLDivElement>(null)

  const handleFeaturedScroll = (direction: 'left' | 'right') => {
    if (!featuredTrackRef.current) return
    const scrollAmount = 340
    featuredTrackRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
    })
  }

  const handleFeaturedKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      handleFeaturedScroll('left')
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      handleFeaturedScroll('right')
    }
  }

  // Use products with explicit featured flag if present, otherwise highlight the top 4 flagship pieces
  const featuredProducts = products.filter((p) => p.featured).length > 0
    ? products.filter((p) => p.featured).slice(0, 4)
    : products.slice(0, 4)

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] text-[#4A3728] font-inter px-6 text-center">
        <div>
          <h2 className="font-fraunces text-2xl mb-2">Error Connecting</h2>
          <p className="text-sm text-[#6B7259]">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--gold-decorative)] selection:text-[var(--bg)] flex flex-col justify-between pb-16 sm:pb-0">
      {/* Skip to main content link as the first focusable element */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2.5 focus:bg-[var(--bg)] focus:text-[var(--ink)] focus:border-2 focus:border-[var(--gold)] focus:shadow-lg focus:font-semibold focus:text-sm"
      >
        Skip to content
      </a>

      {/* Sticky Header with height shrinking on scroll */}
      <header
        ref={mobileMenuRef}
        className={`site-header ${isScrolled ? 'is-scrolled' : ''} px-4 sm:px-8 flex justify-between items-center`}
      >
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' })
          }}
          className="flex flex-col justify-center min-h-[44px] group"
          aria-label="Atelier Fine Furniture Home"
        >
          <span
            className={`font-fraunces font-semibold tracking-tight text-[var(--ink)] group-hover:text-[var(--gold)] transition-all leading-none ${
              isScrolled ? 'text-[24px]' : 'text-[28px]'
            }`}
          >
            ATELIER
          </span>
          {!isScrolled && (
            <span className="text-[11px] font-semibold tracking-[0.2em] text-[var(--gold)] font-inter uppercase mt-1">
              FINE FURNITURE
            </span>
          )}
        </a>

        <div className="hidden md:flex items-center gap-4 lg:gap-6">
          <nav className="flex items-center space-x-4 lg:space-x-6 text-[14px] font-medium uppercase tracking-wider text-[var(--muted)]">
            <a
              href="#collection"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('collection')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
              }}
              aria-current={activeSection === 'collection' ? 'true' : undefined}
              className={`min-h-[44px] flex items-center py-2 px-1 relative transition-colors ${
                activeSection === 'collection' ? 'text-[var(--ink)] font-semibold' : 'text-[var(--muted)] hover:text-[var(--gold)]'
              }`}
            >
              <span className="relative z-10">Shop</span>
              <span
                className={`absolute bottom-1 left-0 h-0.5 bg-[var(--gold)] transition-all duration-300 ${
                  activeSection === 'collection' ? 'w-full' : 'w-0 hover:w-full'
                }`}
              />
            </a>
            <a
              href="#about-us"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('about-us')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
              }}
              aria-current={activeSection === 'about-us' ? 'true' : undefined}
              className={`min-h-[44px] flex items-center py-2 px-1 relative transition-colors ${
                activeSection === 'about-us' ? 'text-[var(--ink)] font-semibold' : 'text-[var(--muted)] hover:text-[var(--gold)]'
              }`}
            >
              <span className="relative z-10">About Us</span>
              <span
                className={`absolute bottom-1 left-0 h-0.5 bg-[var(--gold)] transition-all duration-300 ${
                  activeSection === 'about-us' ? 'w-full' : 'w-0 hover:w-full'
                }`}
              />
            </a>
            <a
              href="#visit-us"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('visit-us')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
              }}
              aria-current={activeSection === 'visit-us' ? 'true' : undefined}
              className={`min-h-[44px] flex items-center py-2 px-1 relative transition-colors ${
                activeSection === 'visit-us' ? 'text-[var(--ink)] font-semibold' : 'text-[var(--muted)] hover:text-[var(--gold)]'
              }`}
            >
              <span className="relative z-10">Contact Us</span>
              <span
                className={`absolute bottom-1 left-0 h-0.5 bg-[var(--gold)] transition-all duration-300 ${
                  activeSection === 'visit-us' ? 'w-full' : 'w-0 hover:w-full'
                }`}
              />
            </a>
          </nav>
          <CustomerAccountControl />
          <LanguageToggle />
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 md:hidden">
          <CustomerAccountControl />
          <LanguageToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] p-2.5 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] hover:text-[var(--gold)] hover:border-[var(--gold)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] transition-colors"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile slide-down navigation drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute top-full left-0 right-0 bg-[var(--bg)] border-b border-[var(--border)] shadow-lg md:hidden z-50 px-6 py-4 flex flex-col space-y-2"
            >
              <button
                type="button"
                onClick={() => handleMobileNavClick('collection')}
                className="text-left font-inter text-[14px] uppercase tracking-[0.18em] font-semibold text-[var(--muted)] hover:text-[var(--gold)] transition-colors min-h-[44px] flex items-center border-b border-[var(--border)]"
              >
                Shop
              </button>
              <button
                type="button"
                onClick={() => handleMobileNavClick('about-us')}
                className="text-left font-inter text-[14px] uppercase tracking-[0.18em] font-semibold text-[var(--muted)] hover:text-[var(--gold)] transition-colors min-h-[44px] flex items-center border-b border-[var(--border)]"
              >
                About Us
              </button>
              <button
                type="button"
                onClick={() => handleMobileNavClick('visit-us')}
                className="text-left font-inter text-[14px] uppercase tracking-[0.18em] font-semibold text-[var(--muted)] hover:text-[var(--gold)] transition-colors min-h-[44px] flex items-center"
              >
                Contact Us
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="flex-grow">

      {/* Redesigned Hero Section */}
      <motion.div
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="hero-section relative flex flex-col items-center justify-center text-center py-20 sm:py-28 md:py-36 px-4 sm:px-6 overflow-hidden border-b border-[var(--border)]"
      >
        {/* Background Video - all viewports, respects reduced motion.
            Mobile autoplay requires muted + playsInline (iOS plays inline instead
            of fullscreen); preload="metadata" keeps the cellular-data cost down
            while still allowing autoplay (never "none", which can stall mobile).
            The poster attribute shows hero-poster.png while the video loads so
            there is no blank flash on slow connections. */}
        {!shouldReduceMotion && (
          <video
            src={HERO_VIDEO_SRC}
            poster={HERO_POSTER_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}
        {/* Fallback poster - shown when reduced motion is enabled, on any viewport */}
        {shouldReduceMotion && (
          <img
            src={HERO_POSTER_SRC}
            alt=""
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}

        {/* Content Overlay */}
        <div className="relative z-10 max-w-3xl mx-auto px-2">
          <span className="text-[14px] font-semibold tracking-[0.22em] text-[var(--gold-on-dark)] uppercase mb-3 sm:mb-4 block font-inter">
            Artisanal Integrity
          </span>
          <h1 className="text-[clamp(40px,7vw,84px)] font-fraunces font-light text-[var(--bg)] tracking-tight leading-[1.05] mb-6 [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]">
            Honest Materials.<br />Meticulous Joinery.
          </h1>
          <p className="font-medium text-[clamp(16px,1.6vw,20px)] max-w-[560px] mx-auto text-white/95 font-inter leading-relaxed mb-8 sm:mb-10">
            Every piece is designed with restraint and built to endure, utilizing local woods and time-tested joinery techniques.
          </p>
          <motion.a
            href="#collection"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById('collection')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
            }}
            className="inline-flex items-center justify-center min-h-[48px] px-8 border border-[var(--bg)] text-xs font-semibold uppercase tracking-wider text-[var(--ink)] bg-[var(--bg)] hover:bg-transparent hover:text-[var(--bg)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2"
            whileHover={!shouldReduceMotion ? { scale: 1.03, boxShadow: '0 4px 12px rgba(250, 247, 242, 0.3)' } : undefined}
            whileTap={!shouldReduceMotion ? { scale: 0.98 } : undefined}
            transition={shouldReduceMotion ? undefined : { type: 'spring', stiffness: 400, damping: 17 }}
          >
            Explore Collection
          </motion.a>
        </div>
      </motion.div>

      {/* Featured Pieces Showcase (Editorial Highlight Strip) */}
      <motion.section
        id="featured"
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="site-section bg-[var(--bg)] border-b border-[var(--border)] overflow-hidden"
      >
        <div className="site-container">
          <SectionHeader
            eyebrow="Curated Pieces"
            title="Featured Highlights"
            subtitle="Four signature handcrafted pieces representing our commitment to honest materials and subtle joinery."
          />

          {/* Editorial Horizontal Strip with snap-mandatory and manual controls */}
          <div className="relative">
            {/* Prev / Next Navigation Buttons (Visible, 44x44) */}
            <div className="hidden md:flex absolute -top-16 right-0 items-center gap-2">
              <button
                type="button"
                onClick={() => handleFeaturedScroll('left')}
                aria-label="Previous featured piece"
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-[var(--border)] bg-white text-[var(--ink)] hover:bg-[var(--gold)] hover:text-white hover:border-[var(--gold)] flex items-center justify-center transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => handleFeaturedScroll('right')}
                aria-label="Next featured piece"
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-[var(--border)] bg-white text-[var(--ink)] hover:bg-[var(--gold)] hover:text-white hover:border-[var(--gold)] flex items-center justify-center transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Scroll Container */}
            <div
              ref={featuredTrackRef}
              tabIndex={0}
              onKeyDown={handleFeaturedKeyDown}
              role="region"
              aria-roledescription="carousel"
              aria-label="Featured furniture pieces"
              className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
            >
              {loading
                ? Array.from({ length: 4 }).map((_, idx) => (
                    <SkeletonFeaturedCard key={`featured-skeleton-${idx}`} animate={!shouldReduceMotion} />
                  ))
                : featuredProducts.map((product) => {
                    const images = productImages[product.id] || (product.image_url ? [product.image_url] : [])
                    const coverImage = images[0] || product.image_url || ''
                    const formattedPrice = `₹${formatPrice(product.price)}`

                    return (
                      <div
                        key={product.id}
                        className="snap-start flex-shrink-0 w-[280px] sm:w-[320px] md:w-[360px] group rounded-lg overflow-hidden bg-white border border-[var(--border)] flex flex-col shadow-sm transition-shadow duration-300 hover:shadow-xl"
                      >
                        {/* Image */}
                        <div
                          className="relative aspect-[4/3] sm:aspect-square overflow-hidden bg-[#F5EFEB] cursor-pointer"
                          onClick={() => navigate(`/product/${product.id}`)}
                        >
                          {coverImage ? (
                            <img
                              src={getOptimizedImageUrl(coverImage, 800, 80)}
                              alt={product.name}
                              loading="lazy"
                              width={400}
                              height={400}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[var(--muted)] font-inter text-sm">
                              No image
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="p-5 flex flex-col flex-grow justify-between bg-white">
                          <div>
                            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--gold)] font-inter block mb-1">
                              {(product.category && getCategoryDisplayName(product.category, t)) || 'FURNITURE'}
                            </span>
                            <h3
                              onClick={() => navigate(`/product/${product.id}`)}
                              className="font-fraunces text-lg sm:text-xl font-normal text-[var(--ink)] hover:text-[var(--gold)] transition-colors cursor-pointer line-clamp-1 mb-2"
                              title={product.name}
                            >
                              {product.name}
                            </h3>
                            <p className="font-inter text-base font-semibold text-[var(--ink)] mb-4">
                              {formattedPrice}
                            </p>
                          </div>

                          {/* "View in catalog" link filtering to this category */}
                          <button
                            type="button"
                            onClick={() => {
                              if (product.category) {
                                handleCategoryChange(formatCategoryName(product.category))
                              }
                              document.getElementById('collection')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--gold)] hover:text-[var(--ink)] transition-colors min-h-[44px] cursor-pointer"
                          >
                            <span>View in catalog</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Category Photo Navigation */}
      <motion.section
        id="categories"
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="site-section bg-white border-b border-[var(--border)]"
      >
        <div className="site-container">
          <SectionHeader
            eyebrow={t('categorySection.browseCategories')}
            title={t('categorySection.shopByCategory')}
          />
          
          <div className="overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] md:overflow-visible">
            <div className="flex w-max items-start gap-6 px-2 pr-14 md:w-full md:justify-center md:gap-10 md:px-0 lg:gap-12">
              {categoryLoading
                ? Array.from({ length: 6 }).map((_, idx) => (
                    <SkeletonCategoryCircle key={`category-skeleton-${idx}`} animate={!shouldReduceMotion} />
                  ))
                : categories.map((cat) => {
                    const isActive = selectedCategory.toLowerCase() === cat.toLowerCase() || (cat === 'All' && selectedCategory === 'All')
                    const displayName = cat === 'All' ? t('categorySection.allPieces') : getCategoryDisplayName(cat, t)
                    const preview = categoryPreviews.find((category) => category.name === cat)

                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          handleCategoryChange(cat)
                          document.getElementById('collection')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
                        }}
                        aria-pressed={isActive}
                        className="group flex w-[100px] shrink-0 snap-start flex-col items-center focus:outline-none cursor-pointer md:w-[140px]"
                      >
                        <motion.div
                          className={`relative flex aspect-square w-[100px] overflow-hidden rounded-full border-2 shadow-[0_6px_16px_rgba(43,36,32,0.16)] transition-all duration-300 md:w-[140px] ${
                            isActive
                              ? 'border-[var(--gold)] ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-white'
                              : 'border-[var(--border)] group-hover:border-[var(--gold)]'
                          } ${cat === 'All' ? 'items-center justify-center bg-[var(--bg)] text-[var(--gold)]' : ''}`}
                          initial={false}
                          animate={{ rotate: shouldReduceMotion ? 0 : -2, scale: 1 }}
                          whileHover={!shouldReduceMotion ? { rotate: 0, scale: 1.06 } : undefined}
                          whileTap={!shouldReduceMotion ? { scale: 0.95 } : undefined}
                          transition={shouldReduceMotion ? undefined : { type: 'spring', stiffness: 200, damping: 12 }}
                        >
                          {cat === 'All' ? (
                            ALL_ICON
                          ) : preview ? (
                            <>
                              <img
                                src={getOptimizedImageUrl(preview.imageUrl, 300, 75)}
                                alt={`${displayName} furniture`}
                                className="h-full w-full object-cover product-image-grade"
                                loading="lazy"
                              />
                              <span aria-hidden="true" className="absolute inset-0 bg-[var(--ink)]/15" />
                            </>
                          ) : null}
                        </motion.div>
                        <span className="mt-3 flex min-h-9 flex-col items-center">
                          <span
                            className={`text-[13px] font-semibold tracking-[0.18em] uppercase transition-colors duration-300 ${
                              isActive ? 'text-[var(--gold)] font-bold' : 'text-[var(--muted)] group-hover:text-[var(--ink)]'
                            }`}
                          >
                            {displayName}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`mt-2 h-0.5 w-5 bg-[var(--gold)] transition-opacity duration-300 ${
                              isActive ? 'opacity-100' : 'opacity-0'
                            }`}
                          />
                        </span>
                      </button>
                    )
                  })}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Collection Catalog */}
      <section
        id="collection"
        className="site-section bg-[var(--bg)] scroll-mt-24"
      >
        <div className="site-container">
          <SectionHeader
            eyebrow={t('collectionSection.curatedCatalog')}
            title={t('collectionSection.currentCollection')}
          />

          {/* Sticky-below-header Toolbar: Category Chips, Count, Sort Select */}
          <div className="sticky top-[64px] sm:top-[84px] z-20 bg-[var(--bg)]/95 backdrop-blur-md py-3.5 border-b border-[var(--border)] mb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 shadow-[0_4px_12px_rgba(43,36,32,0.03)] transition-all">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Category Chips: horizontal scroll with snap on mobile, no 3-line wrap */}
              <div
                role="group"
                aria-label="Filter by category"
                className="flex items-center gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 md:pb-0 [scrollbar-width:none] -mx-1 px-1"
              >
                {categories.map((cat) => {
                  const isActive = selectedCategory.toLowerCase() === cat.toLowerCase() || (cat === 'All' && selectedCategory === 'All')
                  const displayName = cat === 'All' ? t('categorySection.allPieces') : getCategoryDisplayName(cat, t)

                  return (
                    <button
                      key={`chip-${cat}`}
                      type="button"
                      onClick={() => handleCategoryChange(cat)}
                      aria-pressed={isActive}
                      className={`snap-start shrink-0 inline-flex items-center justify-center min-h-[40px] px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] ${
                        isActive
                          ? 'bg-[var(--ink)] text-white border border-[var(--ink)] shadow-sm'
                          : 'bg-white text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--gold)] border border-[var(--border)]'
                      }`}
                    >
                      {displayName}
                    </button>
                  )
                })}
              </div>

              {/* Controls: Result count & Sort dropdown */}
              <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                <span
                  className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] font-inter"
                  aria-live="polite"
                >
                  {filteredAndSortedProducts.length} {filteredAndSortedProducts.length === 1 ? 'piece' : 'pieces'}
                </span>

                <div className="flex items-center gap-2">
                  <label htmlFor="catalog-sort" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] sr-only sm:not-sr-only font-inter">
                    Sort:
                  </label>
                  <div className="relative">
                    <select
                      id="catalog-sort"
                      value={selectedSort}
                      onChange={(e) => handleSortChange(e.target.value)}
                      className="appearance-none bg-white text-[var(--ink)] text-xs font-semibold uppercase tracking-wider pl-3 pr-8 py-2 rounded-full border border-[var(--border)] hover:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)] cursor-pointer min-h-[40px] shadow-sm transition-colors"
                    >
                      <option value="featured">Featured</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                      <option value="newest">Newest</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[var(--muted)]">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Product Grid / Error / Loading / Empty States */}
          {error ? (
            <div className="bg-white border border-[var(--border)] rounded-lg py-16 px-6 text-center max-w-xl mx-auto my-8 shadow-sm">
              <h3 className="font-fraunces text-2xl text-[var(--ink)] mb-2">We're having trouble loading the collection</h3>
              <p className="text-sm text-[var(--muted)] font-inter mb-6">There was a problem fetching our pieces — please check your connection or try again.</p>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  fetchProducts()
                }}
                className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--gold)] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[var(--ink)] transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <motion.div
              variants={containerVariants}
              initial={shouldReduceMotion ? undefined : 'hidden'}
              whileInView={shouldReduceMotion ? undefined : 'show'}
              viewport={{ once: true, amount: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch"
            >
              {Array.from({ length: 8 }).map((_, idx) => (
                <SkeletonCollectionCard key={`collection-skeleton-${idx}`} animate={!shouldReduceMotion} />
              ))}
            </motion.div>
          ) : filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-16 px-6 bg-white border border-[var(--border)] rounded-lg max-w-xl mx-auto my-8 shadow-sm">
              <p className="font-fraunces text-2xl text-[var(--ink)] mb-2">No pieces match these filters</p>
              <p className="text-sm text-[var(--muted)] font-inter mb-6">
                Try selecting a different category or clearing your active filters.
              </p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--ink)] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[var(--gold)] transition-colors cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <CollectionRevealGrid>
              {filteredAndSortedProducts.map((product) => (
                <motion.div key={product.id} variants={childVariants} initial={false} className="h-full">
                  <ProductCard product={product} allImages={productImages} />
                </motion.div>
              ))}
            </CollectionRevealGrid>
          )}
        </div>
      </section>

      {/* About Us Section (Merged Philosophy & Craftsmanship) */}
      <motion.section
        id="about-us"
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="site-section bg-white border-t border-b border-[var(--border)] relative"
      >
        <div className="site-container">
          <SectionHeader
            eyebrow="About Us"
            title="Our Heritage & Process"
          />

          <div className="grid md:grid-cols-2 gap-10 sm:gap-12 lg:gap-16">
            {/* Philosophy Block */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-50px" }}
              className="text-center md:text-left flex flex-col justify-start"
            >
              <span className="text-[13px] font-semibold tracking-[0.18em] uppercase text-[var(--gold)] mb-3 block font-inter">
                {t('philosophySection.eyebrow')}
              </span>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-fraunces font-light text-[var(--ink)] mb-4 sm:mb-6">
                {t('philosophySection.title')}
              </h3>
              <p className="text-sm sm:text-base text-[var(--muted)] font-inter leading-relaxed">
                {t('philosophySection.body')}
              </p>
            </motion.div>

            {/* Craftsmanship Block */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-50px" }}
              className="text-center md:text-left flex flex-col justify-start"
            >
              <span className="text-[13px] font-semibold tracking-[0.18em] uppercase text-[var(--gold)] mb-3 block font-inter">
                {t('craftsmanshipSection.eyebrow')}
              </span>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-fraunces font-light text-[var(--ink)] mb-4 sm:mb-6">
                {t('craftsmanshipSection.title')}
              </h3>
              <p className="text-sm sm:text-base text-[var(--muted)] font-inter leading-relaxed">
                {t('craftsmanshipSection.body')}
              </p>
            </motion.div>
          </div>

          {/* Customer Reviews & Stories Block */}
          <CustomerReviews />
        </div>
      </motion.section>

      {/* Visit Us Section */}
      <motion.section
        id="visit-us"
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="site-section bg-[var(--bg)] border-b border-[var(--border)]"
      >
        <div className="site-container">
          <SectionHeader
            eyebrow={t('visitUs.findUs')}
            title={t('visitUs.visitUs')}
          />

          <div className="grid md:grid-cols-[minmax(0,1fr)_18rem] gap-6 sm:gap-8 items-start">
            <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-sm">
              <iframe
                title="Atelier furniture shop location"
                src="https://maps.google.com/maps?q=Sri+Vishnu+Grand+PG,+Hostel+%26+Guest+House,+Gachibowli,+Hyderabad&z=16&output=embed"
                width="100%"
                height="400"
                className="block w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="border border-[var(--border)] bg-white p-6 sm:p-7 font-inter rounded-lg shadow-sm">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)] mb-3">{t('visitUs.showroom')}</p>
              <p className="text-sm leading-6 text-[var(--ink)] mb-6">{t('visitUs.shopLocation')}</p>
              <div className="border-t border-[var(--border)] pt-5">
                <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)] mb-2">{t('visitUs.hours')}</p>
                <p className="text-sm leading-6 text-[var(--muted)]">{t('visitUs.hoursMonSat')}</p>
                <p className="text-sm leading-6 text-[var(--muted)]">{t('visitUs.hoursSunday')}</p>
              </div>
              <a
                href={SHOP_INFO.telPhone}
                className="mt-6 pt-5 border-t border-[var(--border)] text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--gold)] min-h-[44px] inline-flex items-center gap-2 transition-colors"
                aria-label={`Call showroom at ${SHOP_INFO.phone}`}
              >
                <svg className="w-4 h-4 text-[var(--gold)] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.122-4.1-6.924-6.924l1.293-.97a1.173 1.173 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <span>{SHOP_INFO.phone}</span>
              </a>
            </div>
          </div>
        </div>
      </motion.section>
      </main>

      {/* Footer */}
      <motion.footer
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="bg-white border-t border-[var(--border)] pt-14 pb-12 font-inter text-[13px] text-[var(--muted)]"
      >
        <div className="site-container">
          {/* Main 4-column layout on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 pb-12 border-b border-[var(--border)]">
            {/* Column 1: Brand */}
            <div className="flex flex-col items-start text-left">
              <span className="font-fraunces text-2xl font-semibold tracking-wider text-[var(--ink)]">ATELIER</span>
              <span className="text-[11px] font-semibold tracking-[0.2em] text-[var(--gold)] uppercase mt-1">Fine Furniture</span>
              <p className="mt-3 text-[13px] text-[var(--muted)] leading-relaxed">
                Handcrafted furniture designed with restraint and built to endure using sustainable timber and traditional joinery.
              </p>
              {SHOP_INFO.gstin ? (
                <p className="mt-3 text-[13px] text-[var(--muted)] font-mono">
                  GSTIN: {SHOP_INFO.gstin}
                </p>
              ) : null}
            </div>

            {/* Column 2: Quick Links */}
            <div className="flex flex-col items-start text-left">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)] mb-3">
                {t('footer.quickLinks')}
              </p>
              <nav className="flex flex-col space-y-1">
                <a
                  href="#collection"
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById('collection')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
                  }}
                  className="min-h-[44px] inline-flex items-center text-[13px] text-[var(--muted)] hover:text-[var(--gold)] transition-colors"
                >
                  {t('footer.shop')}
                </a>
                <a
                  href="#about-us"
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById('about-us')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
                  }}
                  className="min-h-[44px] inline-flex items-center text-[13px] text-[var(--muted)] hover:text-[var(--gold)] transition-colors"
                >
                  {t('footer.about')}
                </a>
                <a
                  href="#visit-us"
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById('visit-us')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
                  }}
                  className="min-h-[44px] inline-flex items-center text-[13px] text-[var(--muted)] hover:text-[var(--gold)] transition-colors"
                >
                  {t('footer.contact')}
                </a>
                <Link
                  to="/privacy"
                  className="min-h-[44px] inline-flex items-center text-[13px] text-[var(--muted)] hover:text-[var(--gold)] transition-colors"
                >
                  {t('footer.privacy')}
                </Link>
              </nav>
            </div>

            {/* Column 3: Visit Showroom */}
            <div className="flex flex-col items-start text-left">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)] mb-3">
                {t('footer.visit')}
              </p>
              <p className="text-[13px] text-[var(--ink)] leading-relaxed mb-2">
                {SHOP_INFO.address}
              </p>
              <p className="text-[13px] text-[var(--muted)] mb-3">
                {SHOP_INFO.hoursMonSat}
              </p>
              <a
                href={SHOP_INFO.telPhone}
                className="min-h-[44px] inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--gold)] transition-colors"
                aria-label={`Call showroom at ${SHOP_INFO.phone}`}
              >
                <svg className="w-4 h-4 text-[var(--gold)] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.122-4.1-6.924-6.924l1.293-.97a1.173 1.173 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <span>{SHOP_INFO.phone}</span>
              </a>
            </div>

            {/* Column 4: Follow / Direct Support */}
            <div className="flex flex-col items-start text-left">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)] mb-3">
                {SHOP_INFO.social.instagram || SHOP_INFO.social.youtube ? t('footer.follow') : 'Showroom Care'}
              </p>
              {SHOP_INFO.social.instagram || SHOP_INFO.social.youtube ? (
                <div className="flex flex-col space-y-1">
                  {SHOP_INFO.social.instagram ? (
                    <a
                      href={SHOP_INFO.social.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] inline-flex items-center text-[13px] text-[var(--muted)] hover:text-[var(--gold)] transition-colors"
                    >
                      Instagram ↗
                    </a>
                  ) : null}
                  {SHOP_INFO.social.youtube ? (
                    <a
                      href={SHOP_INFO.social.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] inline-flex items-center text-[13px] text-[var(--muted)] hover:text-[var(--gold)] transition-colors"
                    >
                      YouTube ↗
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                  Have questions about bespoke dimensions, joinery, or showroom visits? Connect directly with our team.
                </p>
              )}
              <a
                href={`https://wa.me/${SHOP_INFO.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 min-h-[44px] inline-flex items-center text-[13px] font-semibold text-[var(--gold)] hover:underline"
              >
                WhatsApp Enquiries ↗
              </a>
            </div>
          </div>

          {/* Policy Links Row */}
          <div className="py-6 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-[13px] text-[var(--muted)] border-b border-[var(--border)]">
            <Link to="/privacy" className="min-h-[44px] inline-flex items-center hover:text-[var(--gold)] transition-colors">
              {t('footer.privacy')}
            </Link>
            <span aria-hidden="true" className="text-[var(--border)] hidden sm:inline">·</span>
            <Link to="/delivery-policy" className="min-h-[44px] inline-flex items-center hover:text-[var(--gold)] transition-colors">
              {t('footer.delivery')}
            </Link>
            <span aria-hidden="true" className="text-[var(--border)] hidden sm:inline">·</span>
            <Link to="/returns-warranty" className="min-h-[44px] inline-flex items-center hover:text-[var(--gold)] transition-colors">
              {t('footer.returnsWarranty')}
            </Link>
          </div>

          {/* Bottom notices and copyright */}
          <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[13px] text-[var(--muted)] text-center sm:text-left">
            <p className="max-w-md leading-relaxed">
              {t('footer.privacyNotice')}
            </p>
            <p className="uppercase tracking-wider">
              © {new Date().getFullYear()} ATELIER. {t('footer.allRightsReserved')}
            </p>
          </div>
        </div>
      </motion.footer>
      
      {/* Unified Floating Action Button (Desktop >= 640px) & Fixed Bottom Action Bar (Mobile < 640px) */}
      <FloatingContactControl />
    </div>
  )
}

export default StorefrontPage
