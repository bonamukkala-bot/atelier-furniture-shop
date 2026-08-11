import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import type { Product } from '../lib/types'
import ChatWidget from '../components/ChatWidget'
import ProductQuickActions from '../components/ProductQuickActions'
import LanguageToggle from '../components/LanguageToggle'
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
const SHOP_LOCATION_TEXT = "Visit our furniture shop in Hyderabad"

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
  return Number(price).toLocaleString('en-IN')
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
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), springConfig)
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), springConfig)

  // Motion templates for the glossy shine
  const percentX = useTransform(x, [-0.5, 0.5], [0, 100])
  const percentY = useTransform(y, [-0.5, 0.5], [0, 100])
  const shineBg = useMotionTemplate`radial-gradient(circle at ${percentX}% ${percentY}%, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 65%)`

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

  // Tag swing animation variants (rotates centered near the top-left hole)
  const tagVariants = {
    initial: { rotate: -6 },
    hover: {
      rotate: -2,
      transition: { type: 'spring' as const, stiffness: 200, damping: 12 }
    }
  }

  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price
  const discountPercent = hasDiscount
    ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100)
    : 0
  const createdAt = new Date(product.created_at).getTime()
  const isNewArrival = !product.sold && Number.isFinite(createdAt) && createdAt >= Date.now() - 14 * 24 * 60 * 60 * 1000 && createdAt <= Date.now()

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      setDirection(-1)
      setCurrentImageIndex((prev) => prev - 1)
      // Reset auto-advance timer
      setIsPaused(true)
      setTimeout(() => setIsPaused(false), 2000)
    }
  }

  const stopCardNavigation = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
  }

  const handleNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setDirection(1)
      setCurrentImageIndex((prev) => prev + 1)
      // Reset auto-advance timer
      setIsPaused(true)
      setTimeout(() => setIsPaused(false), 2000)
    }
  }

  const handleDotClick = (idx: number) => {
    setDirection(idx > currentImageIndex ? 1 : -1)
    setCurrentImageIndex(idx)
    // Reset auto-advance timer
    setIsPaused(true)
    setTimeout(() => setIsPaused(false), 2000)
  }

  const currentImageUrl = images[currentImageIndex] || product.image_url

  // Swipe gesture handlers
  const handleDragEnd = (_e: any, { offset, velocity }: any) => {
    const swipe = swipePower(offset.x, velocity.x)
    if (swipe < -10000 && currentImageIndex < images.length - 1) {
      setDirection(1)
      setCurrentImageIndex((prev) => prev + 1)
      // Reset auto-advance timer
      setIsPaused(true)
      setTimeout(() => setIsPaused(false), 2000)
    } else if (swipe > 10000 && currentImageIndex > 0) {
      setDirection(-1)
      setCurrentImageIndex((prev) => prev - 1)
      // Reset auto-advance timer
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
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 30,
      },
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.95,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 30,
      },
    }),
  }

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
      className="group relative bg-[#FAF7F2] rounded-none border border-[#E4DDD1] overflow-visible transition-shadow duration-300 hover:shadow-2xl flex flex-col justify-between"
    >
      {/* Image Container */}
      <div className="relative w-full h-56 sm:h-64 bg-[#FAF7F2] overflow-hidden border-b border-[#E4DDD1]">
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
            {currentImageUrl ? (
              <>
                <img
                  src={currentImageUrl}
                  alt=""
                  aria-hidden="true"
                  className="product-image-bg"
                  draggable={false}
                />
                <img
                  src={currentImageUrl}
                  alt={product.name}
                  className="product-image-fg product-image-grade"
                  draggable={false}
                />
              </>
            ) : (
              <div className="w-full h-full bg-[#E4DDD1]/30 flex items-center justify-center text-[#6B7259] font-inter text-sm">
                No image
              </div>
            )}
          </motion.div>
          </AnimatePresence>
            <button
              type="button"
              aria-label="Show previous product image"
              onClick={(event) => {
                stopCardNavigation(event)
                handlePrevImage()
              }}
              disabled={currentImageIndex === 0}
              className={`absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-8 sm:h-8 bg-white/80 hover:bg-white text-[#2B2420] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8874B]/80 transition-opacity duration-200 shadow-md ${
                currentImageIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Right arrow */}
            <button
              type="button"
              aria-label="Show next product image"
              onClick={(event) => {
                stopCardNavigation(event)
                handleNextImage()
              }}
              disabled={currentImageIndex === images.length - 1}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-8 sm:h-8 bg-white/80 hover:bg-white text-[#2B2420] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8874B]/80 transition-opacity duration-200 shadow-md ${
                currentImageIndex === images.length - 1 ? 'opacity-30 cursor-not-allowed' : ''
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Image count indicator */}
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-inter">
              {currentImageIndex + 1}/{images.length}
            </div>

            {/* Dot indicators */}
            <div className="absolute bottom-2 left-2 flex gap-1.5">
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
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>

        {/* 3D Glossy Shine Effect Overlay */}
        {!shouldReduceMotion && (
          <motion.div
            style={{ background: shineBg }}
            className="absolute inset-0 pointer-events-none z-20 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
        )}

        {isNewArrival && (
          <span className="absolute top-4 left-4 z-30 rounded-sm bg-[#B8874B] px-2.5 py-1.5 font-inter text-[10px] font-bold uppercase tracking-wider text-[#FAF7F2] shadow-md">
            New Arrival
          </span>
        )}
      </div>

      {/* Swing Tag Price Badge - Perforated edge and top-left eyelet string */}
      <motion.div
        variants={tagVariants}
        initial="initial"
        style={{ transformOrigin: '20% 20%' }}
        className="absolute top-4 right-4 z-30 drop-shadow-md pointer-events-none"
      >
        {/* Loop of string extending from top-left hole to top edge */}
        <svg className="absolute -top-6 -left-3.5 w-12 h-10 overflow-visible" fill="none">
          <path d="M 15 15 C 8 8, 4 4, -8 -12" stroke="#B8874B" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {/* Tag Body (Dashed border simulating perforated/rough edge) */}
        <div className="relative bg-[#FAF7F2] border border-dashed border-[#B8874B]/70 px-4 py-2.5 pt-5 text-center min-w-[85px] rounded-none flex flex-col items-center">
          {/* Hole with metallic brass grommet in top-left */}
          <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-[#FAF7F2] border border-[#B8874B] flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-[#E4DDD1]" />
          </div>
          {hasDiscount ? (
            <div className="flex flex-col items-center gap-0.5 mt-1">
              <span className="font-inter text-[9px] line-through text-[#6B7259] opacity-75">
                ₹{formatPrice(product.compare_at_price!)}
              </span>
              <span className="font-inter text-xs font-bold tracking-wider text-[#4A3728]">
                ₹{formatPrice(product.price)}
              </span>
              <span className="mt-1 px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase bg-[#6B7259] text-white rounded-none">
                {discountPercent}% OFF
              </span>
            </div>
          ) : (
            <span className="font-inter text-xs font-semibold tracking-wider text-[#4A3728] mt-1">
              ₹{formatPrice(product.price)}
            </span>
          )}
        </div>
      </motion.div>

      {/* Info details */}
      <div className="p-5 flex-grow flex flex-col justify-between">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#B8874B] font-inter font-semibold block mb-1">
            {product.category && getCategoryDisplayName(product.category, t)}
          </span>
          <h3 className="font-fraunces text-xl font-normal text-[#2B2420] mb-2 group-hover:text-[#B8874B] transition-colors duration-300">
            {product.name}
          </h3>
        </div>
        {product.material && (
          <p className="text-xs text-[#6B7259] font-inter border-t border-[#E4DDD1]/60 pt-2 mt-2">
            Material: {product.material}
          </p>
        )}
      </div>

      <div className="flex justify-end border-t border-[#E4DDD1]/60 px-4 py-3">
        <ProductQuickActions product={product} phone={CONTACT_PHONE} compact />
      </div>
    </motion.div>
  )
}

function SkeletonFeaturedCard({ animate }: { animate: boolean }) {
  return (
    <div className="relative flex-shrink-0 w-[280px] sm:w-[350px] md:w-[450px] h-[350px] sm:h-[450px] md:h-[500px] rounded-lg overflow-hidden border border-[#E4DDD1] bg-[#FAF7F2]">
      <div className={`absolute inset-0 ${animate ? 'skeleton-shimmer' : 'bg-[#FBF8F3]'}`} />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 pointer-events-none">
        <div className="space-y-3">
          <div className="h-6 w-2/3 rounded-full bg-[#FBF8F3] border border-[#E4DDD1]" />
          <div className="h-5 w-1/3 rounded-full bg-[#FBF8F3] border border-[#E4DDD1]" />
        </div>
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
    <div className="bg-[#FAF7F2] rounded-none border border-[#E4DDD1] overflow-hidden">
      <div className={`h-56 sm:h-64 bg-[#FBF8F3] ${animate ? 'skeleton-shimmer' : ''}`} />
      <div className="p-5 space-y-3">
        <div className="h-5 w-3/4 rounded-full bg-[#FBF8F3]" />
        <div className="h-4 w-1/2 rounded-full bg-[#FBF8F3]" />
        <div className="h-4 w-1/4 rounded-full bg-[#FBF8F3]" />
      </div>
      <div className="border-t border-[#E4DDD1]/60 p-4">
        <div className="h-4 w-1/3 rounded-full bg-[#FBF8F3]" />
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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 md:gap-10"
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
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [productImages, setProductImages] = useState<Record<string, string[]>>({})
  const [categoryPreviews, setCategoryPreviews] = useState<CategoryPreview[]>([])
  const [isMobile, setIsMobile] = useState(false)

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

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
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

  // Filter products matching normalized category casing
  const filteredProducts =
    selectedCategory === 'All'
      ? products
      : products.filter(
          (p) => p.category && formatCategoryName(p.category) === selectedCategory
        )

  const shouldReduceMotion = useReducedMotion()

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
    <div className="min-h-screen bg-[#FAF7F2] text-[#2B2420] selection:bg-[#B8874B] selection:text-[#FAF7F2]">
      {/* Slim Trust Bar */}
      <div className="bg-[#FAF7F2] border-b border-[#E4DDD1] py-2 px-4 sm:px-6 font-inter text-[10px] sm:text-xs font-semibold text-[#4A3728]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-center sm:justify-between items-center gap-y-2 sm:gap-y-0 gap-x-4 sm:gap-x-6 text-center">
          {/* Phone */}
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-[#B8874B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.122-4.1-6.924-6.924l1.293-.97a1.173 1.173 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <span className="break-all">{CONTACT_PHONE}</span>
          </div>
          
          {/* Location */}
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-[#B8874B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="hidden sm:inline">{SHOP_LOCATION_TEXT}</span>
            <span className="sm:hidden">Hyderabad</span>
          </div>

          {/* Handcrafted info */}
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-[#B8874B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Handcrafted, quality furniture</span>
          </div>
        </div>
      </div>

      {/* Premium Header - Admin access button removed */}
      <header className="sticky top-0 z-50 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#E4DDD1] py-4 sm:py-5 px-4 sm:px-8 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="font-fraunces text-xl sm:text-2xl font-semibold tracking-tight text-[#2B2420]">ATELIER</span>
          <span className="text-[9px] sm:text-[10px] tracking-widest text-[#B8874B] font-inter uppercase">Fine Furniture</span>
        </div>
        <div className="hidden md:flex items-center gap-3 lg:gap-4">
          <nav className="flex items-center space-x-5 sm:space-x-6 text-xs font-semibold tracking-wider uppercase text-[#6B7259]">
          <a
            href="#collection"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById('collection')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
            }}
            className="hover:text-[#B8874B] transition-colors py-2 relative group"
          >
            <span className="relative z-10">{t('nav.collection')}</span>
            <motion.span
              className="absolute bottom-0 left-0 h-px bg-[#B8874B] w-0 group-hover:w-full transition-all duration-300 ease-out"
              initial={false}
              whileHover={{ width: '100%' }}
              style={{ width: shouldReduceMotion ? '100%' : undefined }}
            />
          </a>
          <a
            href="#philosophy"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById('philosophy')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
            }}
            className="hover:text-[#B8874B] transition-colors py-2 relative group"
          >
            <span className="relative z-10">{t('nav.philosophy')}</span>
            <motion.span
              className="absolute bottom-0 left-0 h-px bg-[#B8874B] w-0 group-hover:w-full transition-all duration-300 ease-out"
              initial={false}
              whileHover={{ width: '100%' }}
              style={{ width: shouldReduceMotion ? '100%' : undefined }}
            />
          </a>
          <a
            href="#craftsmanship"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById('craftsmanship')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
            }}
            className="hover:text-[#B8874B] transition-colors py-2 relative group"
          >
            <span className="relative z-10">{t('nav.craftsmanship')}</span>
            <motion.span
              className="absolute bottom-0 left-0 h-px bg-[#B8874B] w-0 group-hover:w-full transition-all duration-300 ease-out"
              initial={false}
              whileHover={{ width: '100%' }}
              style={{ width: shouldReduceMotion ? '100%' : undefined }}
            />
          </a>
          </nav>
          <a
            href={`tel:${CONTACT_PHONE}`}
            className="inline-flex items-center gap-2 rounded-full border border-[#E4DDD1] bg-[#FAF7F2] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2B2420] shadow-[0_2px_8px_rgba(43,36,32,0.06)] transition-colors duration-200 hover:border-[#B8874B] hover:text-[#B8874B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8874B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF7F2]"
          >
            <svg className="h-3.5 w-3.5 text-[#B8874B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.122-4.1-6.924-6.924l1.293-.97a1.173 1.173 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <span>{CONTACT_PHONE}</span>
          </a>
          <LanguageToggle />
        </div>
        {/* Mobile compact controls: phone + language */}
        <div className="flex items-center gap-2 md:hidden">
          <a
            href={`tel:${CONTACT_PHONE}`}
            className="inline-flex items-center gap-2 rounded-full border border-[#E4DDD1] bg-[#FAF7F2] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2B2420] shadow-[0_2px_8px_rgba(43,36,32,0.06)] transition-colors duration-200 hover:border-[#B8874B] hover:text-[#B8874B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8874B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF7F2]"
          >
            <svg className="h-3 w-3 text-[#B8874B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.122-4.1-6.924-6.924l1.293-.97a1.173 1.173 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <span className="text-sm">{CONTACT_PHONE}</span>
          </a>
          <LanguageToggle />
        </div>
        <div className="w-12 sm:w-16 hidden md:block"></div>
      </header>

      {/* Redesigned Hero Section */}
      <motion.div
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="relative flex flex-col items-center justify-center text-center py-20 sm:py-28 md:py-36 px-4 sm:px-6 overflow-hidden border-b border-[#E4DDD1]"
      >
        {/* Background Video - only on desktop, respects reduced motion */}
        {!shouldReduceMotion && (
          <video
            src={HERO_VIDEO_SRC}
            poster={HERO_POSTER_SRC}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover hidden md:block"
          />
        )}
        {/* Fallback poster - shows on mobile or when reduced motion is enabled */}
        <img
          src={HERO_POSTER_SRC}
          alt=""
          className="absolute inset-0 w-full h-full object-cover md:hidden"
        />
        {/* Fallback poster for reduced motion (shows on desktop when reduced motion is enabled) */}
        {shouldReduceMotion && (
          <img
            src={HERO_POSTER_SRC}
            alt=""
            className="absolute inset-0 w-full h-full object-cover hidden md:block"
          />
        )}

        {/* Dark gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/50 pointer-events-none" />

        {/* Content Overlay */}
        <div className="relative z-10 max-w-3xl mx-auto px-2">
          <span className="text-[10px] sm:text-xs font-semibold tracking-widest text-[#B8874B] uppercase mb-3 sm:mb-4 block font-inter">
            Artisanal Integrity
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-fraunces font-light text-[#FAF7F2] tracking-tight leading-[1.1] sm:leading-[1.1] mb-6">
            Honest Materials.<br />Meticulous Joinery.
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-[#E4DDD1] font-inter max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed">
            Every piece is designed with restraint and built to endure, utilizing local woods and time-tested joinery techniques.
          </p>
          <motion.a
            href="#collection"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById('collection')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
            }}
            className="inline-flex items-center justify-center px-5 sm:px-6 py-3 sm:py-3.5 border border-[#FAF7F2] text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#2B2420] bg-[#FAF7F2] hover:bg-transparent hover:text-[#FAF7F2] transition-all duration-300 min-h-[44px]"
            whileHover={!shouldReduceMotion ? { scale: 1.03, boxShadow: '0 4px 12px rgba(250, 247, 242, 0.3)' } : undefined}
            whileTap={!shouldReduceMotion ? { scale: 0.98 } : undefined}
            transition={shouldReduceMotion ? undefined : { type: 'spring', stiffness: 400, damping: 17 }}
          >
            Explore Collection
          </motion.a>
        </div>
      </motion.div>

      {/* Featured Pieces Showcase */}
      <motion.section
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="relative py-16 sm:py-20 bg-[#FAF7F2] overflow-hidden"
      >
        {/* Section Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-8 sm:mb-12">
          <motion.div
            variants={containerVariants}
            initial={shouldReduceMotion ? undefined : 'hidden'}
            whileInView={shouldReduceMotion ? undefined : 'show'}
            viewport={{ once: true, amount: 0.18 }}
          >
            <motion.span variants={childVariants} className="text-[10px] sm:text-xs uppercase tracking-widest text-[#B8874B] font-semibold mb-2 block font-inter">
              Curated Pieces
            </motion.span>
            <motion.h2 variants={childVariants} className="text-2xl sm:text-3xl font-fraunces font-normal text-[#2B2420]">
              The Collection
            </motion.h2>
          </motion.div>
        </div>

        {/* Horizontal Scrolling Showcase */}
        <div className="relative">
          {/* Scroll Container */}
          <div className="overflow-x-auto scrollbar-hide">
            <motion.div
              className="flex gap-4 sm:gap-6 px-4 sm:px-6 pb-4"
              animate={
                !shouldReduceMotion && !isMobile
                  ? {
                      x: [0, -1000],
                      transition: {
                        x: {
                          repeat: Infinity,
                          repeatType: "loop",
                          duration: 40,
                          ease: "linear",
                        },
                      },
                    }
                  : {}
              }
              whileHover={
                !shouldReduceMotion && !isMobile
                  ? {
                      x: [0, 0],
                      transition: {
                        x: {
                          repeat: 0,
                          duration: 0,
                        },
                      },
                    }
                  : {}
              }
              style={{ width: "max-content" }}
            >
              {/* Featured Product Cards */}
              {loading
                ? Array.from({ length: 4 }).map((_, idx) => (
                    <SkeletonFeaturedCard key={`featured-skeleton-${idx}`} animate={!shouldReduceMotion} />
                  ))
                : products.slice(0, 6).map((product) => {
                    // Match the catalog card's image source: use images from
                    // product_images first, then the product's primary image_url.
                    const images = productImages[product.id] || (product.image_url ? [product.image_url] : [])
                    const coverImage = images[0] || product.image_url || ""
                    const formattedPrice = `₹${formatPrice(product.price)}`

                    return (
                      <motion.div
                        key={product.id}
                        className="relative flex-shrink-0 w-[280px] sm:w-[350px] md:w-[450px] h-[350px] sm:h-[450px] md:h-[500px] rounded-lg overflow-hidden group cursor-pointer"
                        onClick={() => navigate(`/product/${product.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            navigate(`/product/${product.id}`)
                          }
                        }}
                        role="link"
                        tabIndex={0}
                        whileHover={!shouldReduceMotion ? { scale: 1.02 } : undefined}
                        transition={shouldReduceMotion ? undefined : { duration: 0.3 }}
                      >
                        {/* Product Image */}
                        {coverImage ? (
                          <>
                            <img
                              src={coverImage}
                              alt=""
                              aria-hidden="true"
                              className="product-image-bg"
                            />
                            <img
                              src={coverImage}
                              alt={product.name}
                              className="product-image-fg product-image-grade"
                            />
                          </>
                        ) : (
                          <div className="w-full h-full bg-[#E4DDD1] flex items-center justify-center">
                            <span className="text-[#6B7259] font-inter text-sm">No image</span>
                          </div>
                        )}

                        {/* Dark Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                        {/* Product Info Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                          <h3 className="text-white font-fraunces text-lg sm:text-xl font-medium mb-2">
                            {product.name}
                          </h3>
                          <p className="text-[#E4DDD1] font-inter text-sm sm:text-base">
                            {formattedPrice}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
            </motion.div>
          </div>
        </div>

        {/* Section-level wordmark: deliberately outside the scrolling card strip. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-5 right-4 sm:bottom-6 sm:right-6 font-fraunces text-[10px] sm:text-xs font-semibold tracking-[0.3em] text-[#B8874B]/45"
        >
          ATELIER
        </span>
      </motion.section>

      {/* Category Photo Navigation */}
      <motion.div
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="border-b border-[#E4DDD1] py-10 sm:py-14 bg-[#FAF7F2]"
      >
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial={shouldReduceMotion ? undefined : 'hidden'}
            whileInView={shouldReduceMotion ? undefined : 'show'}
            viewport={{ once: true, amount: 0.18 }}
            className="text-center mb-8 sm:mb-10 px-4 sm:px-6"
          >
            <motion.span variants={childVariants} className="text-[10px] sm:text-xs uppercase tracking-widest text-[#B8874B] font-semibold mb-2 block font-inter">
              {t('categorySection.browseCategories')}
            </motion.span>
            <motion.h2 variants={childVariants} className="text-xl sm:text-2xl font-fraunces font-normal text-[#2B2420]">
              {t('categorySection.shopByCategory')}
            </motion.h2>
          </motion.div>
          
          <div className="overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] md:overflow-visible">
            <div className="flex w-max items-start gap-6 px-4 pr-14 md:w-full md:justify-center md:gap-10 md:px-6 md:pr-6 lg:gap-12">
              {categoryLoading
                ? Array.from({ length: 6 }).map((_, idx) => (
                    <SkeletonCategoryCircle key={`category-skeleton-${idx}`} animate={!shouldReduceMotion} />
                  ))
                : categories.map((cat) => {
                    const isActive = selectedCategory === cat
                    const displayName = cat === 'All' ? t('categorySection.allPieces') : getCategoryDisplayName(cat, t)
                    const preview = categoryPreviews.find((category) => category.name === cat)

                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat)
                          document.getElementById('collection')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
                        }}
                        aria-pressed={isActive}
                        className="group flex w-[100px] shrink-0 snap-start flex-col items-center focus:outline-none cursor-pointer md:w-[140px]"
                      >
                        <motion.div
                          className={`relative flex aspect-square w-[100px] overflow-hidden rounded-full border-2 shadow-[0_6px_16px_rgba(43,36,32,0.16)] transition-colors duration-300 md:w-[140px] ${
                            isActive
                              ? 'border-[#B8874B]'
                              : 'border-[#B8874B]/70 group-hover:border-[#B8874B]'
                          } ${cat === 'All' ? 'items-center justify-center bg-[#FAF7F2] text-[#B8874B]' : ''}`}
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
                                src={preview.imageUrl}
                                alt={`${displayName} furniture`}
                                className="h-full w-full object-cover product-image-grade"
                              />
                              <span aria-hidden="true" className="absolute inset-0 bg-[#2B2420]/15" />
                            </>
                          ) : null}
                        </motion.div>
                        <span className="mt-3 flex min-h-9 flex-col items-center">
                          <span
                            className={`text-[9px] sm:text-[10px] tracking-wider uppercase font-semibold transition-colors duration-300 ${
                              isActive ? 'text-[#B8874B]' : 'text-[#6B7259] group-hover:text-[#2B2420]'
                            }`}
                          >
                            {displayName}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`mt-2 h-0.5 w-5 bg-[#B8874B] transition-opacity duration-300 ${
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
      </motion.div>

      {/* Collection Catalog */}
      {/* Plain <div>, deliberately NOT an animated motion.div: this section is very tall
          on mobile (stacked product cards, ~4400px), so the old whileInView amount:0.18
          reveal could never trigger (18% of the section can't fit in the viewport) and
          left the entire section stuck at opacity:0. The reveal animations live on the
          section header, grid (stagger) and card wrappers below — keep this container
          fail-safe to visible. */}
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-24"
        id="collection"
      >
        {/* Section Header */}
        <motion.div
          variants={containerVariants}
          initial={shouldReduceMotion ? undefined : 'hidden'}
          whileInView={shouldReduceMotion ? undefined : 'show'}
          viewport={{ once: true, amount: 0.18 }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-12 sm:mb-16 border-b border-[#E4DDD1] pb-4 sm:pb-6"
        >
          <div>
            <motion.span variants={childVariants} className="text-[10px] sm:text-xs uppercase tracking-widest text-[#B8874B] font-semibold mb-2 block font-inter">
              {t('collectionSection.curatedCatalog')}
            </motion.span>
            <motion.h2 variants={childVariants} className="text-2xl sm:text-3xl font-fraunces font-normal text-[#2B2420]">
              {t('collectionSection.currentCollection')}
            </motion.h2>
          </div>
          
          {/* Duplicate text pills row has been removed */}
        </motion.div>

        {/* Product Grid with Staggered Viewport Entrance */}
        {error ? (
          <div className="bg-[#FAF7F2] border border-[#E4DDD1] rounded-none py-16 px-6 text-center max-w-3xl mx-auto">
            <h3 className="font-fraunces text-2xl text-[#2B2420] mb-3">We're having trouble loading the collection</h3>
            <p className="text-[#6B7259] mb-6">There was a problem fetching our pieces — please check your connection or try again.</p>
            <div>
              <button
                onClick={() => {
                  setError('')
                  fetchProducts()
                }}
                className="inline-block bg-[#B8874B] text-white px-4 py-2 text-sm font-semibold hover:bg-[#4A3728] transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : loading ? (
          <motion.div
            variants={containerVariants}
            initial={shouldReduceMotion ? undefined : 'hidden'}
            whileInView={shouldReduceMotion ? undefined : 'show'}
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 md:gap-10"
          >
            {Array.from({ length: 8 }).map((_, idx) => (
              <SkeletonCollectionCard key={`collection-skeleton-${idx}`} animate={!shouldReduceMotion} />
            ))}
          </motion.div>
        ) : filteredProducts.length === 0 ? (
          <p className="text-[#6B7259] font-inter text-center py-12 px-4">No products available in this category yet.</p>
        ) : (
          <CollectionRevealGrid>
            {filteredProducts.map((product) => (
              <motion.div key={product.id} variants={childVariants} initial={false}>
                <ProductCard product={product} allImages={productImages} />
              </motion.div>
            ))}
          </CollectionRevealGrid>
        )}
      </div>

      {/* Philosophy Section */}
      <motion.section
        id="philosophy"
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="py-16 sm:py-24 bg-white border-t border-b border-[#E4DDD1] scroll-mt-20 relative"
      >
        {/* Subtle gradient transition at top */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#FAF7F2] to-white opacity-50 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
          >
            <motion.span variants={childVariants} className="text-[10px] sm:text-xs uppercase tracking-widest text-[#B8874B] font-semibold mb-3 block font-inter">
              {t('philosophySection.eyebrow')}
            </motion.span>
            <motion.h2 variants={childVariants} className="text-2xl sm:text-3xl md:text-4xl font-fraunces font-light text-[#2B2420] mb-6">
              {t('philosophySection.title')}
            </motion.h2>
            <motion.p variants={childVariants} className="text-xs sm:text-sm md:text-base text-[#6B7259] font-inter leading-relaxed max-w-2xl mx-auto px-2">
              {t('philosophySection.body')}
            </motion.p>
          </motion.div>
        </div>
      </motion.section>

      {/* Craftsmanship Section */}
      <motion.section
        id="craftsmanship"
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="py-16 sm:py-24 bg-[#FAF7F2] border-b border-[#E4DDD1] scroll-mt-20 relative"
      >
        {/* Subtle gradient transition at top */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white to-[#FAF7F2] opacity-50 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
          >
            <motion.span variants={childVariants} className="text-[10px] sm:text-xs uppercase tracking-widest text-[#B8874B] font-semibold mb-3 block font-inter">
              {t('craftsmanshipSection.eyebrow')}
            </motion.span>
            <motion.h2 variants={childVariants} className="text-2xl sm:text-3xl md:text-4xl font-fraunces font-light text-[#2B2420] mb-6">
              {t('craftsmanshipSection.title')}
            </motion.h2>
            <motion.p variants={childVariants} className="text-xs sm:text-sm md:text-base text-[#6B7259] font-inter leading-relaxed max-w-2xl mx-auto px-2">
              {t('craftsmanshipSection.body')}
            </motion.p>
          </motion.div>
        </div>
      </motion.section>

      {/* Visit Us Section */}
      <motion.section
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="py-16 sm:py-24 bg-white border-b border-[#E4DDD1]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="mb-8 sm:mb-10"
          >
            <motion.span variants={childVariants} className="text-[10px] sm:text-xs uppercase tracking-widest text-[#B8874B] font-semibold mb-2 block font-inter">
              {t('visitUs.findUs')}
            </motion.span>
            <motion.h2 variants={childVariants} className="text-2xl sm:text-3xl font-fraunces font-normal text-[#2B2420]">
              {t('visitUs.visitUs')}
            </motion.h2>
          </motion.div>

          <div className="grid md:grid-cols-[minmax(0,1fr)_18rem] gap-6 sm:gap-8 items-start">
            <div className="overflow-hidden rounded-lg border border-[#E4DDD1] bg-[#FAF7F2] shadow-sm">
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

            <div className="border border-[#E4DDD1] bg-[#FAF7F2] p-6 sm:p-7 font-inter">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[#B8874B] mb-3">{t('visitUs.showroom')}</p>
              <p className="text-sm leading-6 text-[#2B2420] mb-6">{t('visitUs.shopLocation')}</p>
              <div className="border-t border-[#E4DDD1] pt-5">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-[#B8874B] mb-2">{t('visitUs.hours')}</p>
                <p className="text-sm leading-6 text-[#6B7259]">{t('visitUs.hoursMonSat')}</p>
                <p className="text-sm leading-6 text-[#6B7259]">{t('visitUs.hoursSunday')}</p>
              </div>
              <p className="mt-6 pt-5 border-t border-[#E4DDD1] text-sm font-semibold text-[#4A3728] break-all">{CONTACT_PHONE}</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <motion.footer
        variants={sectionVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'show'}
        viewport={{ once: true, amount: 0.18 }}
        className="bg-[#FAF7F2] border-t border-[#E4DDD1] py-12 sm:py-16 px-4 sm:px-8 text-center font-inter text-[10px] sm:text-xs text-[#6B7259]"
      >
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4 sm:gap-6">
          <div className="flex flex-col items-center">
            <span className="font-fraunces text-xl sm:text-2xl font-semibold tracking-wider text-[#2B2420]">ATELIER</span>
            <span className="text-[9px] tracking-widest text-[#B8874B] uppercase mt-1">Fine Furniture</span>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 md:gap-8 text-[#4A3728] font-semibold mt-2">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B8874B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.122-4.1-6.924-6.924l1.293-.97a1.173 1.173 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <span className="break-all">{CONTACT_PHONE}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#B8874B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span>{SHOP_LOCATION_TEXT}</span>
            </div>
          </div>
          
          <div className="w-16 h-px bg-[#E4DDD1] my-2" />

          <p className="max-w-md text-[10px] leading-relaxed text-[#6B7259]/75">
            We only use your contact details to reach you about your order or respond to enquiries.
          </p>
          
          <p className="text-[10px] tracking-wider text-[#6B7259]/80 uppercase">
            © {new Date().getFullYear()} ATELIER. All rights reserved.
          </p>
        </div>
      </motion.footer>
      
      <ChatWidget />
    </div>
  )
}

export default StorefrontPage
