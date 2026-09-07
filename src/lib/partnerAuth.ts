import { supabase } from './supabaseClient'
import type { DeliveryPartner, PartnerSession, PartnerOrder } from './types'

const PARTNER_SESSION_KEY = 'atelier_delivery_partner_session'

/**
 * Computes a standard SHA-256 hex string for a 4-digit PIN.
 * This guarantees PINs are NEVER stored or transmitted in raw plaintext format.
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin.trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Delivery partner login via phone number and 4-digit PIN
 */
export async function partnerLogin(phone: string, pin: string): Promise<PartnerSession> {
  const cleanPhone = phone.trim()
  const pinHash = await hashPin(pin)

  const { data, error } = await supabase.rpc('verify_partner_login', {
    p_phone: cleanPhone,
    p_pin_hash: pinHash,
  })

  if (error) {
    throw new Error(error.message || 'Failed to authenticate delivery partner.')
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Invalid phone number or 4-digit PIN.')
  }

  const session: PartnerSession = {
    token: data.session_token,
    partner: data.partner,
  }

  // Persist session in localStorage
  localStorage.setItem(PARTNER_SESSION_KEY, JSON.stringify(session))
  return session
}

/**
 * Retrieve current active partner session from localStorage
 */
export function getStoredPartnerSession(): PartnerSession | null {
  try {
    const raw = localStorage.getItem(PARTNER_SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PartnerSession
  } catch (err) {
    console.error('Error reading stored partner session:', err)
    return null
  }
}

/**
 * Log out partner and clear local session
 */
export function partnerLogout(): void {
  localStorage.removeItem(PARTNER_SESSION_KEY)
}

/**
 * Fetch orders strictly scoped to this delivery partner via database-enforced RPC
 */
export async function fetchPartnerOrders(sessionToken: string): Promise<PartnerOrder[]> {
  const { data, error } = await supabase.rpc('get_partner_orders', {
    p_session_token: sessionToken,
  })

  if (error) {
    // If session expired or invalid, clear local storage
    if (error.message?.includes('Invalid or expired')) {
      partnerLogout()
    }
    throw new Error(error.message || 'Could not fetch assigned orders.')
  }

  return (data || []) as PartnerOrder[]
}

/**
 * Update status of an assigned order (e.g. Preparing -> Out for Delivery)
 */
export async function updatePartnerOrderStatus(
  sessionToken: string,
  orderId: string,
  status: string,
  note?: string
): Promise<{ success: boolean; code?: string }> {
  const { data, error } = await supabase.rpc('update_partner_order_status', {
    p_session_token: sessionToken,
    p_order_id: orderId,
    p_status: status,
    p_note: note || null,
  })

  if (error) {
    throw new Error(error.message || 'Failed to update order status.')
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Could not update order status.')
  }

  return data
}

/**
 * Confirm delivery with customer's 6-digit code and required proof of delivery photo
 */
export async function confirmPartnerDeliveryWithCode(
  sessionToken: string,
  orderId: string,
  code: string,
  proofUrl?: string
): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase.rpc('confirm_partner_delivery_with_code', {
    p_session_token: sessionToken,
    p_order_id: orderId,
    p_code: code.trim(),
    p_proof_url: proofUrl || null,
  })

  if (error) {
    throw new Error(error.message || 'Verification failed.')
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Incorrect confirmation code.')
  }

  return data
}

/**
 * Upload proof of delivery photo to Supabase storage bucket `delivery-proofs`
 */
export async function uploadProofOfDeliveryPhoto(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg'
  const fileName = `pod_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('delivery-proofs')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    // If bucket doesn't exist, fallback to product-images
    console.warn('Upload to delivery-proofs failed, trying fallback bucket:', uploadError)
    const { error: fallbackErr } = await supabase.storage
      .from('product-images')
      .upload(`proofs/${fileName}`, file, { cacheControl: '3600', upsert: true })

    if (fallbackErr) throw uploadError

    const { data: fallbackData } = supabase.storage
      .from('product-images')
      .getPublicUrl(`proofs/${fileName}`)

    return fallbackData.publicUrl
  }

  const { data } = supabase.storage
    .from('delivery-proofs')
    .getPublicUrl(fileName)

  return data.publicUrl
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Delivery Partner Helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function adminListDeliveryPartners(): Promise<DeliveryPartner[]> {
  const { data, error } = await supabase.rpc('admin_list_delivery_partners')
  if (error) {
    // Fallback direct query if RPC not yet run
    const { data: directData, error: directError } = await supabase
      .from('delivery_partners')
      .select('id, name, phone, status, created_at, updated_at')
      .order('name', { ascending: true })

    if (directError) throw error
    return (directData || []) as DeliveryPartner[]
  }
  return (data || []) as DeliveryPartner[]
}

export async function adminUpsertDeliveryPartner(
  partner: { id?: string; name: string; phone: string; pin?: string; status?: 'active' | 'inactive' }
): Promise<{ success: boolean; id?: string }> {
  let pinHash: string | null = null
  if (partner.pin && partner.pin.trim().length === 4) {
    pinHash = await hashPin(partner.pin.trim())
  }

  const { data, error } = await supabase.rpc('admin_upsert_delivery_partner', {
    p_id: partner.id || null,
    p_name: partner.name.trim(),
    p_phone: partner.phone.trim(),
    p_pin_hash: pinHash,
    p_status: partner.status || 'active',
  })

  if (error) throw new Error(error.message)
  if (data && !data.success) throw new Error(data.error)

  return data
}

export async function adminSetPartnerPin(
  partnerId: string,
  newPin: string
): Promise<{ success: boolean }> {
  if (newPin.trim().length !== 4 || !/^\d{4}$/.test(newPin.trim())) {
    throw new Error('PIN must be exactly 4 digits.')
  }

  const pinHash = await hashPin(newPin.trim())

  const { data, error } = await supabase.rpc('admin_set_delivery_partner_pin', {
    p_partner_id: partnerId,
    p_pin_hash: pinHash,
  })

  if (error) throw new Error(error.message)
  if (data && !data.success) throw new Error(data.error)

  return data
}
