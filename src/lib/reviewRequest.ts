import { supabase } from './supabaseClient'

export interface ReviewRequestOrder {
  id: string
  customer_name?: string | null
  customer_phone?: string | null
  product_name?: string | null
  review_requested?: boolean | null
  customers?: {
    name?: string | null
    phone?: string | null
  } | null
  products?: {
    name?: string | null
  } | null
}

export interface ReviewRequestResult {
  success: boolean
  skipped?: boolean
  reason?: string
  whatsappUrl?: string
  windowOpened?: boolean
}

/**
 * Constructs the standard WhatsApp review request message.
 */
export function buildReviewMessage(
  customerName: string,
  productName: string,
  reviewLink: string
): string {
  return `Hi ${customerName}! 👋

Thank you for choosing Atelier Fine Furniture for your ${productName}. We hope it's already found its perfect place in your home.

Your experience matters a lot to us — if you have a moment, we'd be truly grateful if you could share it in a quick Google review:

${reviewLink}

Thank you for supporting our craft. 🙏
— Team Atelier`
}

/**
 * Shortens a URL using TinyURL with a fallback to the original URL.
 */
export async function shortenReviewUrl(longUrl: string): Promise<string> {
  try {
    const response = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`,
      { signal: AbortSignal.timeout(2000) }
    )
    if (response.ok) {
      const shortUrl = await response.text()
      if (shortUrl && shortUrl.trim().startsWith('http')) {
        return shortUrl.trim()
      }
    }
  } catch (error) {
    console.warn('TinyURL link shortening failed or timed out, using direct URL:', error)
  }
  return longUrl
}

/**
 * Core review-request sender / trigger.
 * Reusable across manual admin clicks and automated delivery triggers.
 *
 * Guards against:
 * 1. Firing more than once (if review_requested is already true).
 * 2. Missing phone number or Google Place ID.
 */
export async function triggerReviewRequest(
  order: ReviewRequestOrder,
  options?: {
    googlePlaceId?: string
    targetWindow?: Window | null
  }
): Promise<ReviewRequestResult> {
  try {
    if (!order || !order.id) {
      return { success: false, reason: 'Invalid order' }
    }

    // 1. Guard against firing if review_requested is already true
    if (order.review_requested) {
      return { success: false, skipped: true, reason: 'Review request already marked as sent' }
    }

    // Verify current review_requested status directly from DB to prevent race conditions
    const { data: currentOrder, error: checkError } = await supabase
      .from('orders')
      .select('review_requested')
      .eq('id', order.id)
      .maybeSingle()

    if (checkError) {
      console.warn('Failed to verify review_requested status from DB:', checkError)
    } else if (currentOrder?.review_requested) {
      return { success: false, skipped: true, reason: 'Review request already sent' }
    }

    // 2. Resolve Customer Phone
    const rawPhone =
      order.customer_phone ||
      order.customers?.phone ||
      null

    if (!rawPhone) {
      return { success: false, reason: 'No customer phone number available' }
    }

    const cleanPhone = rawPhone.replace(/\D/g, '')
    if (!cleanPhone) {
      return { success: false, reason: 'Invalid customer phone number' }
    }

    // Ensure country code format for WhatsApp (defaults to 91 for India if 10 digits)
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone

    // 3. Resolve Google Place ID
    let placeId = options?.googlePlaceId
    if (!placeId) {
      const { data: settings } = await supabase
        .from('shop_settings')
        .select('google_place_id')
        .eq('id', 1)
        .maybeSingle()
      placeId = settings?.google_place_id || ''
    }

    if (!placeId) {
      return { success: false, reason: 'Google Business Place ID is not configured in Settings' }
    }

    // 4. Build Review Link & Message
    const googleReviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`
    const reviewLink = await shortenReviewUrl(googleReviewUrl)

    const customerName =
      order.customer_name ||
      order.customers?.name ||
      'Customer'

    const productName =
      order.product_name ||
      order.products?.name ||
      'Order'

    const message = buildReviewMessage(customerName, productName, reviewLink)
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`

    // 5. Open WhatsApp tab (using pre-opened window if provided to bypass popup blockers)
    let windowOpened = false
    if (options?.targetWindow && !options.targetWindow.closed) {
      try {
        options.targetWindow.location.href = whatsappUrl
        windowOpened = true
      } catch (e) {
        console.warn('Failed to redirect pre-opened window:', e)
      }
    }

    if (!windowOpened && typeof window !== 'undefined') {
      const openedWin = window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      windowOpened = !!openedWin
    }

    // 6. Mark review_requested as true in database
    const { error: updateError } = await supabase
      .from('orders')
      .update({ review_requested: true, updated_at: new Date().toISOString() })
      .eq('id', order.id)

    if (updateError) {
      console.error('Failed to update review_requested flag on order:', updateError)
    }

    return {
      success: true,
      whatsappUrl,
      windowOpened,
    }
  } catch (err: any) {
    console.error('Error triggering review request:', err)
    return { success: false, reason: err?.message || 'Unknown error' }
  }
}
