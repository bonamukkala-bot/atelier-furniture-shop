import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import type { Product } from '../lib/types'
import { getOptimizedImageUrl } from '../lib/imageOptimization'
import { CONTACT_PHONE } from './StorefrontPage'
import ProductQuickActions from '../components/ProductQuickActions'
import LanguageToggle from '../components/LanguageToggle'

function formatPrice(price: number): string {
  return Math.round(Number(price)).toLocaleString('en-IN')
}

interface DimensionRow {
  label: string
  value: string
}

function parseDimensions(value: string): DimensionRow[] | null {
  const normalized = value.replace(/×/g, 'x').trim()
  const number = '(\\d+(?:\\.\\d+)?)'
  const unit = '(?:\\s*([a-zA-Z]+))?'
  const labeledPattern = new RegExp(`([A-Za-z][A-Za-z ]*):\\s*${number}\\s*x\\s*${number}\\s*x\\s*${number}${unit}`, 'g')
  const labeledRows: DimensionRow[] = []
  let labeledMatch: RegExpExecArray | null

  while ((labeledMatch = labeledPattern.exec(normalized)) !== null) {
    const groupLabel = labeledMatch[1].trim()
    const groupUnit = labeledMatch[5] || ''
    const values = [labeledMatch[2], labeledMatch[3], labeledMatch[4]]
    ;['Width', 'Depth', 'Height'].forEach((label, index) => {
      labeledRows.push({
        label: `${groupLabel} ${label}`,
        value: `${values[index]}${groupUnit ? ` ${groupUnit}` : ''}`,
      })
    })
  }

  if (labeledRows.length > 0) return labeledRows

  const simpleMatch = normalized.match(new RegExp(`^${number}\\s*x\\s*${number}\\s*x\\s*${number}${unit}$`))
  if (!simpleMatch) return null

  const simpleUnit = simpleMatch[4] || ''
  return ['Width', 'Depth', 'Height'].map((label, index) => ({
    label,
    value: `${simpleMatch[index + 1]}${simpleUnit ? ` ${simpleUnit}` : ''}`,
  }))
}

function ProductDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openSection, setOpenSection] = useState<string | null>(null)

  const fetchProduct = async () => {
    if (!id) {
      setError('Product not found.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setCurrentImageIndex(0)

    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (productError || !productData) {
      setProduct(null)
      setError(productError?.message || 'Product not found.')
      setLoading(false)
      return
    }

    setProduct(productData)
    // This is the same image query and primary-image fallback used by the
    // working storefront collection carousel.
    const { data: imagesData } = await supabase
      .from('product_images')
      .select('product_id, image_url, sort_order')
      .eq('product_id', id)
      .order('sort_order', { ascending: true })

    const imagesMap: Record<string, string[]> = {}
    imagesData?.forEach((image) => {
      if (!imagesMap[image.product_id]) {
        imagesMap[image.product_id] = []
      }
      imagesMap[image.product_id].push(image.image_url)
    })
    const fetchedImages = imagesMap[productData.id] || (productData.image_url ? [productData.image_url] : [])
    setImages(fetchedImages)
    setLoading(false)
  }

  useEffect(() => {
    fetchProduct()
  }, [id])

  const shouldReduceMotion = useReducedMotion()
  const hasDiscount = Boolean(product?.compare_at_price && product.compare_at_price > product.price)
  const discountPercent = hasDiscount && product?.compare_at_price
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : 0
  // Same value shape and primary-image fallback used in the storefront card.
  const currentImageUrl = images[currentImageIndex] || product?.image_url

  const showImage = (nextIndex: number) => {
    setDirection(nextIndex > currentImageIndex ? 1 : -1)
    setCurrentImageIndex(nextIndex)
  }

  // Same slide variants used by the working storefront product-card carousel.
  const slideVariants = {
    enter: (slideDirection: number) => ({
      x: shouldReduceMotion ? 0 : slideDirection > 0 ? '100%' : '-100%',
      opacity: shouldReduceMotion ? 1 : 0,
      scale: shouldReduceMotion ? 1 : 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: shouldReduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 30 },
    },
    exit: (slideDirection: number) => ({
      x: shouldReduceMotion ? 0 : slideDirection < 0 ? '100%' : '-100%',
      opacity: shouldReduceMotion ? 1 : 0,
      scale: shouldReduceMotion ? 1 : 0.95,
      transition: shouldReduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 30 },
    }),
  }

  const handleDragEnd = (_event: unknown, { offset, velocity }: { offset: { x: number }; velocity: { x: number } }) => {
    const swipe = Math.abs(offset.x) * velocity.x
    if (swipe < -10000 && currentImageIndex < images.length - 1) {
      showImage(currentImageIndex + 1)
    } else if (swipe > 10000 && currentImageIndex > 0) {
      showImage(currentImageIndex - 1)
    }
  }

  const enquireOnWhatsApp = () => {
    if (!product) return
    const phone = CONTACT_PHONE.replace(/\D/g, '')
    const message = `Hi! I'm interested in the ${product.name} (₹${formatPrice(product.price)}). Could you share more details?`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return <main className="min-h-screen bg-[#FAF7F2] flex items-center justify-center font-inter text-sm text-[#6B7259]">Loading piece...</main>
  }

  if (error || !product) {
    const notFound = /not found/i.test(error || '') || !product

    return (
      <main className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center gap-5 px-4 text-center">
        {notFound ? (
          <>
            <h1 className="font-fraunces text-3xl text-[#2B2420]">This piece has found a new home</h1>
            <p className="text-[#6B7259] max-w-xl">It looks like the piece you were looking for is no longer available. Explore our current collection to find something similar.</p>
            <Link to="/" className="mt-4 inline-block bg-[#B8874B] text-white px-4 py-2 text-sm font-semibold hover:bg-[#4A3728] transition-colors">
              {t('productDetail.backToCurrentCollection')}
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-fraunces text-2xl text-[#2B2420]">We're having trouble loading this piece</h1>
            <p className="text-[#6B7259] max-w-xl">There was an error fetching this product. Please try again or check your connection.</p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => fetchProduct()} className="bg-[#B8874B] text-white px-4 py-2 text-sm font-semibold hover:bg-[#4A3728] transition-colors">Try Again</button>
              <button onClick={() => {
                const phone = CONTACT_PHONE.replace(/\D/g, '')
                window.open(`https://wa.me/${phone}`, '_blank', 'noopener,noreferrer')
              }} className="border border-[#E4DDD1] px-4 py-2 text-sm font-semibold text-[#2B2420]">Contact via WhatsApp</button>
            </div>
          </>
        )}
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#2B2420]">
      <header className="border-b border-[#E4DDD1] bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <Link to="/" className="font-fraunces text-xl sm:text-2xl font-semibold tracking-tight">ATELIER</Link>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link to="/#collection" className="text-[10px] sm:text-xs font-inter font-semibold uppercase tracking-widest text-[#6B7259] hover:text-[#B8874B]">
              {t('productDetail.backToCollection')}
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <Link to="/#collection" className="inline-flex items-center gap-2 text-[10px] font-inter font-semibold uppercase tracking-widest text-[#B8874B] hover:text-[#4A3728] mb-8">
          <span aria-hidden="true">←</span> {t('productDetail.backToCollection')}
        </Link>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div
            className="relative w-full bg-[#FAF7F2] overflow-hidden border border-[#E4DDD1]"
            style={{ height: 'clamp(20rem, 55vw, 37.5rem)' }}
          >
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
                      src={getOptimizedImageUrl(currentImageUrl, 1200, 75)}
                      alt=""
                      aria-hidden="true"
                      className="product-image-bg"
                      draggable={false}
                    />
                    <img
                      src={getOptimizedImageUrl(currentImageUrl, 1200, 80)}
                      alt={`Image of ${product.name}`}
                      className="product-image-fg product-image-grade"
                      draggable={false}
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-inter text-sm text-[#6B7259]">No image available</div>
                )}
              </motion.div>
            </AnimatePresence>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous product image"
                  disabled={currentImageIndex === 0}
                  onClick={() => showImage(currentImageIndex - 1)}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#FAF7F2]/90 text-[#2B2420] shadow-md hover:bg-white ${currentImageIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Next product image"
                  disabled={currentImageIndex === images.length - 1}
                  onClick={() => showImage(currentImageIndex + 1)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#FAF7F2]/90 text-[#2B2420] shadow-md hover:bg-white ${currentImageIndex === images.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  →
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {images.map((_, index) => (
                    <button
                      type="button"
                      key={index}
                      aria-label={`Show image ${index + 1}`}
                      onClick={() => showImage(index)}
                      className={`w-2 h-2 rounded-full ${index === currentImageIndex ? 'bg-[#B8874B]' : 'bg-[#FAF7F2]/80'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="lg:pt-6">
            {product.category && <p className="text-[10px] font-inter font-semibold uppercase tracking-widest text-[#B8874B] mb-3">{product.category}</p>}
            <h1 className="font-fraunces text-4xl sm:text-5xl font-normal leading-tight mb-6">{product.name}</h1>

            <div className="flex items-baseline gap-3 pb-7 border-b border-[#E4DDD1]">
              {hasDiscount && <span className="font-inter text-base text-[#6B7259] line-through">₹{formatPrice(product.compare_at_price!)}</span>}
              <span className="font-inter text-xl font-semibold text-[#4A3728]">₹{formatPrice(product.price)}</span>
              {hasDiscount && (
                <span className="rounded-sm bg-[#B8874B] px-2 py-0.5 font-inter text-[10px] font-bold uppercase tracking-wider text-[#FAF7F2]">
                  {discountPercent}% OFF
                </span>
              )}
            </div>

            <div className="py-7 border-b border-[#E4DDD1]">
              <h2 className="font-fraunces text-xl mb-4">{t('productDetail.pieceDetails')}</h2>
              <dl className="space-y-4 font-inter text-sm">
                {product.category && <div className="flex justify-between gap-6"><dt className="uppercase tracking-wider text-[10px] font-semibold text-[#6B7259]">{t('productDetail.category')}</dt><dd>{product.category}</dd></div>}
                {product.material && <div className="flex justify-between gap-6"><dt className="uppercase tracking-wider text-[10px] font-semibold text-[#6B7259]">{t('productDetail.material')}</dt><dd>{product.material}</dd></div>}
              </dl>
            </div>

            <div className="border-b border-[#E4DDD1]">
              {[
                { title: t('productDetail.aboutThisProduct'), content: product.description },
                { title: t('productDetail.dimensions'), content: product.dimensions },
                { title: t('productDetail.careInstructions'), content: product.care_instructions },
              ].filter((section) => section.content?.trim()).map((section) => {
                const isOpen = openSection === section.title

                return (
                  <div key={section.title} className="border-b border-[#E4DDD1] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenSection(isOpen ? null : section.title)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-4 py-5 text-left group"
                    >
                      <span className="font-fraunces text-xl text-[#2B2420]">{section.title}</span>
                      <motion.svg
                        animate={{ rotate: shouldReduceMotion ? 0 : isOpen ? 180 : 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
                        className="w-5 h-5 shrink-0 text-[#B8874B]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </motion.svg>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={shouldReduceMotion ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={shouldReduceMotion ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
                          transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          {section.title === 'Dimensions' ? (
                            (() => {
                              const dimensionRows = parseDimensions(section.content!)

                              return dimensionRows ? (
                                <dl className="divide-y divide-[#E4DDD1] pb-5 font-inter text-sm">
                                  {dimensionRows.map((row) => (
                                    <div key={row.label} className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0">
                                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7259]">{row.label}</dt>
                                      <dd className="text-right text-[#2B2420]">{row.value}</dd>
                                    </div>
                                  ))}
                                </dl>
                              ) : (
                                <p className="pb-5 font-inter text-sm leading-relaxed text-[#6B7259] whitespace-pre-line">{section.content}</p>
                              )
                            })()
                          ) : (
                            <p className="pb-5 font-inter text-sm leading-relaxed text-[#6B7259] whitespace-pre-line">{section.content}</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-6">
              <button
                type="button"
                onClick={enquireOnWhatsApp}
                className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-4 bg-[#4A3728] text-[#FAF7F2] font-inter text-xs font-semibold uppercase tracking-widest hover:bg-[#B8874B] transition-colors duration-300"
              >
                {t('productDetail.enquireOnWhatsApp')}
              </button>
              <ProductQuickActions product={product} phone={CONTACT_PHONE} contactActions={false} />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default ProductDetailPage
