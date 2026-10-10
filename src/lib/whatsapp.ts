import type { Product } from './types'
import { SHOP_INFO } from './constants'

export interface WhatsAppLinkOptions {
  product?: Product | { id?: string; name: string; price: number }
  url?: string
  customMessage?: string
  language?: string
}

function formatPrice(price: number): string {
  return Math.round(Number(price)).toLocaleString('en-IN')
}

/**
 * Shared helper to build standardized, encoded WhatsApp enquiry links with i18n support.
 * Format: https://wa.me/919014996929?text=<encoded message>
 * Message: "Hi Atelier, I'm interested in "{name}" (₹{price}). {product URL or #anchor}"
 */
export function buildWhatsAppLink({
  product,
  url,
  customMessage,
  language = 'en',
}: WhatsAppLinkOptions = {}): string {
  const phone = SHOP_INFO.whatsappNumber

  if (customMessage) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(customMessage)}`
  }

  if (product) {
    const productUrl =
      url ||
      (typeof window !== 'undefined' && product.id
        ? `${window.location.origin}/product/${product.id}`
        : '')
    const formattedPrice = formatPrice(product.price)

    const isTelugu = language && language.toLowerCase().startsWith('te')
    const message = isTelugu
      ? `హాయ్ అటెలియర్, నాకు "${product.name}" (₹${formattedPrice}) పై ఆసక్తి ఉంది. ${productUrl}`.trim()
      : `Hi Atelier, I'm interested in "${product.name}" (₹${formattedPrice}). ${productUrl}`.trim()

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  }

  return `https://wa.me/${phone}`
}

/**
 * Optional lightweight analytics hook for enquiry tracking.
 * Dispatches to dataLayer if available on window, without adding extra libraries.
 */
export function trackEnquiryClick(productId?: string, ctaName: string = 'whatsapp_enquiry') {
  if (typeof window !== 'undefined') {
    const win = window as unknown as { dataLayer?: Array<Record<string, unknown>> }
    if (win.dataLayer && Array.isArray(win.dataLayer)) {
      win.dataLayer.push({
        event: 'enquiry_click',
        product_id: productId,
        cta_name: ctaName,
        timestamp: new Date().toISOString(),
      })
    }
  }
}
