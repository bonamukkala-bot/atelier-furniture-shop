import { useState } from 'react'
import type { Product } from '../lib/types'
import { useToast } from '../context/ToastContext'

interface ProductQuickActionsProps {
  product: Product
  phone: string
  compact?: boolean
  contactActions?: boolean
}

function formatPrice(price: number): string {
  return Number(price).toLocaleString('en-IN')
}

function ProductQuickActions({ product, phone, compact = false, contactActions = true }: ProductQuickActionsProps) {
  const { showToast } = useToast()
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const productUrl = `${window.location.origin}/product/${product.id}`
  const cleanPhone = phone.replace(/\D/g, '')

  const stopCardNavigation = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
  }

  const copyProductLink = async () => {
    try {
      await navigator.clipboard.writeText(productUrl)
      showToast('Product link copied.', 'success')
    } catch {
      showToast('Unable to copy product link.', 'error')
    }
    setShareMenuOpen(false)
  }

  const shareOnWhatsApp = () => {
    const message = `Have a look at the ${product.name}: ${productUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    setShareMenuOpen(false)
  }

  const handleShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
    stopCardNavigation(event)
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: `Have a look at the ${product.name}`, url: productUrl })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setShareMenuOpen(true)
      }
      return
    }
    setShareMenuOpen((isOpen) => !isOpen)
  }

  const buttonClass = compact
    ? 'inline-flex min-h-10 min-w-10 items-center justify-center border border-[#B8874B]/50 bg-[#FAF7F2]/90 text-[#B8874B] transition-colors hover:bg-[#B8874B] hover:text-[#FAF7F2]'
    : 'inline-flex min-h-10 min-w-10 items-center justify-center border border-[#E4DDD1] bg-[#FAF7F2] text-[#B8874B] transition-colors hover:bg-[#B8874B] hover:text-[#FAF7F2]'

  return (
    <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      {contactActions && <a
        href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi! I'm interested in the ${product.name} (₹${formatPrice(product.price)}). Could you share more details?`)}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`Enquire about ${product.name} on WhatsApp`}
        title="Enquire on WhatsApp"
        className={buttonClass}
        onClick={(event) => event.stopPropagation()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" />
          <path d="M9 9.5c.4 1.3 1.2 2.2 2.5 2.8 1.2.6 2 .7 2.5.2l.8-.8" />
        </svg>
      </a>}
      {contactActions && <a
        href={`tel:${phone}`}
        aria-label={`Call ${phone}`}
        title="Call"
        className={buttonClass}
        onClick={(event) => event.stopPropagation()}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6.6 3.5 9 3l2 4.5-1.8 1.5a14.4 14.4 0 0 0 5.8 5.8l1.5-1.8 4.5 2-.5 2.4c-.2 1-1.1 1.7-2.1 1.6C10.7 18.2 5.8 13.3 5 5.6c-.1-1 .6-1.9 1.6-2.1Z" />
        </svg>
      </a>}
      <div className="relative">
        <button
          type="button"
          aria-label={`Share ${product.name}`}
          aria-expanded={shareMenuOpen}
          title="Share"
          className={buttonClass}
          onClick={handleShare}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="m8.2 10.8 7.5-4.5M8.2 13.2l7.5 4.5" />
          </svg>
        </button>
        {shareMenuOpen && (
          <div className="absolute right-0 bottom-full z-50 mb-2 w-44 border border-[#E4DDD1] bg-[#FAF7F2] p-1 shadow-lg">
            <button type="button" onClick={(event) => { stopCardNavigation(event); void copyProductLink() }} className="block w-full px-3 py-2 text-left font-inter text-[11px] text-[#2B2420] hover:bg-[#E4DDD1]/50">
              Copy Link
            </button>
            <button type="button" onClick={(event) => { stopCardNavigation(event); shareOnWhatsApp() }} className="block w-full px-3 py-2 text-left font-inter text-[11px] text-[#2B2420] hover:bg-[#E4DDD1]/50">
              Share on WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductQuickActions
