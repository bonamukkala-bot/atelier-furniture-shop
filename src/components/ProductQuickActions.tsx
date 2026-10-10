import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Product } from '../lib/types'
import { SHOP_INFO } from '../lib/constants'
import { buildWhatsAppLink, trackEnquiryClick } from '../lib/whatsapp'
import { useToast } from '../context/ToastContext'

interface ProductQuickActionsProps {
  product: Product
  phone?: string
  compact?: boolean
  contactActions?: boolean
}

function ProductQuickActions({
  product,
  phone = SHOP_INFO.phone,
  contactActions = true,
}: ProductQuickActionsProps) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const productUrl = typeof window !== 'undefined' ? `${window.location.origin}/product/${product.id}` : ''
  const telHref = SHOP_INFO.telPhone || `tel:${phone.replace(/\D/g, '')}`

  const stopCardNavigation = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
  }

  const handleWhatsAppClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    stopCardNavigation(event)
    trackEnquiryClick(product.id, 'product_card_whatsapp')
  }

  const copyProductLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(productUrl)
        showToast(t('enquiry.linkCopied', 'Link copied to clipboard'), 'success')
      } else {
        showToast(t('enquiry.linkCopied', 'Link copied to clipboard'), 'success')
      }
    } catch {
      showToast('Unable to copy product link.', 'error')
    }
    setShareMenuOpen(false)
  }

  const handleShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
    stopCardNavigation(event)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Have a look at the ${product.name}`,
          url: productUrl,
        })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    // Fallback: Copy link to clipboard and show toast
    await copyProductLink()
  }

  const whatsappUrl = buildWhatsAppLink({
    product,
    url: productUrl,
    language: i18n.language,
  })

  return (
    <div
      className="flex items-center gap-2 w-full"
      onClick={(event) => event.stopPropagation()}
    >
      {contactActions && (
        <>
          {/* Primary Action: Full-width / Expanded Enquire on WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsAppClick}
            aria-label={`${t('enquiry.onWhatsApp', 'Enquire on WhatsApp')} - ${product.name}`}
            title={t('enquiry.onWhatsApp', 'Enquire on WhatsApp')}
            className="flex-1 min-h-[44px] h-[44px] px-3 bg-[var(--ink)] hover:bg-[#3D3024] active:bg-[#1A140F] text-white rounded-[6px] text-[15px] font-semibold font-inter flex items-center justify-center gap-2 transition-colors duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2"
          >
            {/* WhatsApp Icon */}
            <svg
              className="w-4 h-4 fill-current flex-shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m-3.53 3.42c-.19 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.21 3.07c.15.2 2.06 3.28 5.08 4.49.72.29 1.28.46 1.72.6.72.23 1.38.2 1.9.12.58-.08 1.79-.73 2.04-1.44.26-.71.26-1.32.18-1.44-.08-.13-.27-.2-.56-.35-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.69.15-.2.3-.79.98-.97 1.18-.18.2-.36.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.69-1.66-.94-2.28-.25-.59-.51-.51-.69-.52l-.59-.01z" />
            </svg>
            <span className="truncate">{t('enquiry.onWhatsApp', 'Enquire on WhatsApp')}</span>
          </a>

          {/* FUTURE EXTENSION SLOT: Reserve with deposit button
              When ready to enable online reservations, insert <button className="...">Reserve with Deposit</button> here */}

          {/* Secondary Action 1: Call (44x44 icon button) */}
          <a
            href={telHref}
            aria-label={t('enquiry.callAbout', { name: product.name, defaultValue: `Call about ${product.name}` })}
            title={t('enquiry.call', 'Call')}
            onClick={stopCardNavigation}
            className="min-h-[44px] min-w-[44px] h-[44px] w-[44px] rounded-[6px] border border-[var(--border)] bg-[var(--bg)] hover:bg-[#EFE9DE] active:bg-[#E5DDCF] text-[var(--ink)] flex items-center justify-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 flex-shrink-0"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M6.6 3.5 9 3l2 4.5-1.8 1.5a14.4 14.4 0 0 0 5.8 5.8l1.5-1.8 4.5 2-.5 2.4c-.2 1-1.1 1.7-2.1 1.6C10.7 18.2 5.8 13.3 5 5.6c-.1-1 .6-1.9 1.6-2.1Z" />
            </svg>
          </a>

          {/* Secondary Action 2: Share (44x44 icon button) */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              aria-label={t('enquiry.shareAbout', { name: product.name, defaultValue: `Share ${product.name}` })}
              aria-expanded={shareMenuOpen}
              title={t('enquiry.share', 'Share')}
              onClick={handleShare}
              className="min-h-[44px] min-w-[44px] h-[44px] w-[44px] rounded-[6px] border border-[var(--border)] bg-[var(--bg)] hover:bg-[#EFE9DE] active:bg-[#E5DDCF] text-[var(--ink)] flex items-center justify-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="18" cy="5" r="2.5" />
                <circle cx="6" cy="12" r="2.5" />
                <circle cx="18" cy="19" r="2.5" />
                <path d="m8.2 10.8 7.5-4.5M8.2 13.2l7.5 4.5" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default ProductQuickActions
