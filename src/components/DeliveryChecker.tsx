import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { CONTACT_PHONE } from '../pages/StorefrontPage'
import { useToast } from '../context/ToastContext'
import type { Product, DeliveryZone } from '../lib/types'

interface DeliveryCheckerProps {
  product: Product
}

interface CheckResult {
  checked: boolean
  isDeliverable: boolean
  zoneId: string | null
  zoneName: string | null
  fee: number | null
}

function formatPrice(price: number): string {
  return Math.round(Number(price)).toLocaleString('en-IN')
}

export default function DeliveryChecker({ product }: DeliveryCheckerProps) {
  const { showToast } = useToast()

  // Delivery enabled flag
  const [deliveryEnabled, setDeliveryEnabled] = useState<boolean | null>(null)

  // Delivery zones from Supabase
  const [dbZones, setDbZones] = useState<DeliveryZone[]>([])
  const [loadingZones, setLoadingZones] = useState(true)

  // Checker state
  const [areaInput, setAreaInput] = useState('')
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)

  // Enquiry form state
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [doorFlatBuilding, setDoorFlatBuilding] = useState('')
  const [streetLocality, setStreetLocality] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Fetch zones and shop settings on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [{ data: zonesData }, { data: settingsData }] = await Promise.all([
          supabase.from('delivery_zones').select('*').order('fee', { ascending: true }),
          supabase.from('shop_settings').select('delivery_enabled').eq('id', 1).maybeSingle(),
        ])

        if (zonesData) {
          setDbZones(zonesData)
        }

        if (settingsData && settingsData.delivery_enabled !== undefined) {
          setDeliveryEnabled(settingsData.delivery_enabled)
        } else {
          setDeliveryEnabled(true)
        }
      } catch (err) {
        console.error('Error loading delivery settings / zones:', err)
        setDeliveryEnabled(true)
      } finally {
        setLoadingZones(false)
      }
    }
    loadData()
  }, [])

  // Dynamic zone matching logic against Supabase delivery_zones
  const evaluateZone = (input: string): { isDeliverable: boolean; zoneId: string | null; zoneName: string | null; fee: number | null } => {
    const rawTrimmed = input.trim()
    const query = rawTrimmed.toLowerCase()
    if (!query) {
      return { isDeliverable: false, zoneId: null, zoneName: null, fee: null }
    }

    // 1. Check for 6-digit pincode first (pure numeric or extracted 6-digit match)
    const pincodeMatch = rawTrimmed.match(/\b\d{6}\b/)
    const pincode = /^\d{6}$/.test(rawTrimmed) ? rawTrimmed : pincodeMatch ? pincodeMatch[0] : null

    if (pincode) {
      for (const zone of dbZones) {
        const zonePincodes = zone.pincodes || []
        if (zonePincodes.some((p) => p.trim() === pincode)) {
          return {
            isDeliverable: true,
            zoneId: zone.id,
            zoneName: zone.zone_name,
            fee: zone.fee,
          }
        }
      }
    }

    // 2. Check area name matching (case-insensitive substring match)
    for (const zone of dbZones) {
      const areas = zone.area_names || []
      const isMatch = areas.some((area) => {
        const cleanArea = area.trim().toLowerCase()
        return cleanArea && (query.includes(cleanArea) || cleanArea.includes(query))
      })

      if (isMatch) {
        return {
          isDeliverable: true,
          zoneId: zone.id,
          zoneName: zone.zone_name,
          fee: zone.fee,
        }
      }
    }

    return {
      isDeliverable: false,
      zoneId: null,
      zoneName: null,
      fee: null,
    }
  }

  const handleCheckDelivery = (e: React.FormEvent) => {
    e.preventDefault()
    if (!areaInput.trim()) return

    const result = evaluateZone(areaInput)
    setCheckResult({
      checked: true,
      isDeliverable: result.isDeliverable,
      zoneId: result.zoneId,
      zoneName: result.zoneName,
      fee: result.fee,
    })
  }

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSubmitSuccess(false)

    // Validation
    const trimmedName = customerName.trim()
    const trimmedDoor = doorFlatBuilding.trim()
    const trimmedStreet = streetLocality.trim()
    const trimmedArea = areaInput.trim()

    if (!trimmedName) {
      setFormError('Please enter your full name.')
      return
    }

    // Strict Indian mobile validation:
    // Strip spaces, dashes, parentheses, or leading +91 / 91
    let cleanedPhone = customerPhone.replace(/[\s\-()]/g, '')
    if (cleanedPhone.startsWith('+91')) {
      cleanedPhone = cleanedPhone.slice(3)
    } else if (cleanedPhone.startsWith('91') && cleanedPhone.length === 12) {
      cleanedPhone = cleanedPhone.slice(2)
    }

    if (!/^[6-9]\d{9}$/.test(cleanedPhone)) {
      setFormError('Enter a valid 10-digit mobile number')
      return
    }

    // House/Flat No., Building Name validation: required, min 5 chars, not purely numeric (e.g. not a pincode)
    if (!trimmedDoor || trimmedDoor.length < 5 || /^\d+$/.test(trimmedDoor)) {
      setFormError('Enter a valid House/Flat No., Building Name (min 5 characters, not purely numeric).')
      return
    }

    // Street / Locality / Landmark validation: required, min 5 chars
    if (!trimmedStreet || trimmedStreet.length < 5) {
      setFormError('Enter a valid Street / Locality / Landmark (min 5 characters).')
      return
    }

    if (!trimmedArea) {
      setFormError('Please enter and check your delivery area / pincode above first.')
      return
    }

    // Determine deliverability and zone from checked area input
    let activeResult = checkResult
    if (!activeResult || !activeResult.checked) {
      const evalResult = evaluateZone(trimmedArea)
      activeResult = {
        checked: true,
        isDeliverable: evalResult.isDeliverable,
        zoneId: evalResult.zoneId,
        zoneName: evalResult.zoneName,
        fee: evalResult.fee,
      }
    }

    setSubmitting(true)

    try {
      // Insert enquiry record into delivery_enquiries
      const { error: insertError } = await supabase
        .from('delivery_enquiries')
        .insert({
          product_id: product.id,
          customer_name: trimmedName,
          phone: cleanedPhone,
          door_flat_building: trimmedDoor,
          street_locality: trimmedStreet,
          area_text: trimmedArea,
          zone_id: activeResult.zoneId,
          is_deliverable: activeResult.isDeliverable,
        })

      if (insertError) {
        console.error('Delivery enquiry insert error:', insertError)
        throw new Error(insertError.message || 'Unable to save enquiry.')
      }

      setSubmitSuccess(true)
      showToast('Enquiry submitted successfully! Opening WhatsApp...', 'success')

      // Open WhatsApp deep link with configured phone number
      const shopPhone = CONTACT_PHONE.replace(/\D/g, '')
      const deliveryStatusText = activeResult.isDeliverable
        ? `Delivery available (₹${formatPrice(activeResult.fee || 0)})`
        : 'Outside delivery area (Pickup available)'

      const fullAddress = `${trimmedDoor}, ${trimmedStreet}, ${trimmedArea}`
      const message = `New delivery enquiry:\nName: ${trimmedName}\nPhone: ${cleanedPhone}\nAddress: ${fullAddress}\nProduct: ${product.name} (₹${formatPrice(product.price)})\nDelivery Estimate: ${deliveryStatusText}`

      window.open(
        `https://wa.me/${shopPhone}?text=${encodeURIComponent(message)}`,
        '_blank',
        'noopener,noreferrer'
      )

      // Reset form
      setCustomerName('')
      setCustomerPhone('')
      setDoorFlatBuilding('')
      setStreetLocality('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit enquiry. Please try again.')
      showToast('Failed to submit enquiry. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // If loading or delivery is explicitly disabled in shop settings, do not render
  if (loadingZones || deliveryEnabled === false) {
    return null
  }

  return (
    <div className="mt-8 pt-8 border-t border-[#E4DDD1]">
      {/* ── Section Header ────────────────────────────────────────────── */}
      <div className="mb-5">
        <h2 className="font-fraunces text-2xl text-[#2B2420] tracking-tight mb-1">
          Delivery & Enquiries
        </h2>
        <p className="font-inter text-xs text-[#6B7259] leading-relaxed">
          Check delivery availability for your neighborhood in Hyderabad or send us a delivery enquiry.
        </p>
      </div>

      {/* ── Delivery Checker Box ──────────────────────────────────────── */}
      <div className="bg-[#FAF7F2] border border-[#E4DDD1] p-5 sm:p-6 mb-6">
        <label
          htmlFor="area-check-input"
          className="block font-inter text-[11px] font-semibold uppercase tracking-wider text-[#4A3728] mb-2"
        >
          Check delivery to your area
        </label>
        <form onSubmit={handleCheckDelivery} className="flex flex-col sm:flex-row gap-2">
          <input
            id="area-check-input"
            type="text"
            value={areaInput}
            onChange={(e) => {
              setAreaInput(e.target.value)
              if (checkResult) setCheckResult(null)
            }}
            placeholder="Enter area, neighborhood, or pincode (e.g., Madhapur or 500081)"
            className="flex-1 bg-white border border-[#E4DDD1] px-3.5 py-2.5 text-sm text-[#2B2420] placeholder-[#6B7259]/60 focus:outline-none focus:border-[#B8874B] transition-colors"
          />
          <button
            type="submit"
            disabled={!areaInput.trim() || loadingZones}
            className="px-5 py-2.5 bg-[#4A3728] text-[#FAF7F2] font-inter text-xs font-semibold uppercase tracking-wider hover:bg-[#B8874B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shrink-0"
          >
            Check
          </button>
        </form>

        {/* Checker Result Message */}
        {checkResult && checkResult.checked && (
          <div className="mt-4 pt-4 border-t border-[#E4DDD1]/80">
            {checkResult.isDeliverable ? (
              <div className="flex items-center gap-2.5 text-emerald-800 bg-emerald-50/80 border border-emerald-200/80 px-3.5 py-2.5 rounded-sm">
                <svg
                  className="w-4 h-4 shrink-0 text-emerald-700"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="font-inter text-xs sm:text-sm font-medium">
                  Delivery available — ₹{formatPrice(checkResult.fee || 0)}
                  {checkResult.zoneName && (
                    <span className="text-emerald-700/80 text-xs ml-1.5 font-normal">
                      ({checkResult.zoneName})
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 text-[#4A3728] bg-[#FAF7F2] border border-[#E4DDD1] px-3.5 py-2.5 rounded-sm">
                <svg
                  className="w-4 h-4 shrink-0 text-[#B8874B]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="font-inter text-xs sm:text-sm font-medium text-[#2B2420]">
                  Outside our standard delivery area, workshop pickup available.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Enquiry Form ──────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E4DDD1] p-5 sm:p-6 shadow-sm">
        <h3 className="font-fraunces text-lg text-[#2B2420] mb-1">
          Request Delivery / Custom Quote
        </h3>
        <p className="font-inter text-xs text-[#6B7259] mb-4">
          Submit your details to check final delivery logistics and connect directly with our team on WhatsApp.
        </p>

        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-inter rounded-sm">
            {formError}
          </div>
        )}

        {submitSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-inter rounded-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Your delivery enquiry has been recorded and WhatsApp opened!</span>
          </div>
        )}

        <form onSubmit={handleEnquirySubmit} className="space-y-4">
          <div>
            <label className="block font-inter text-[11px] font-semibold uppercase tracking-wider text-[#6B7259] mb-1">
              Your Name <span className="text-[#B8874B]">*</span>
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="w-full bg-[#FAF7F2]/50 border border-[#E4DDD1] px-3.5 py-2.5 text-sm text-[#2B2420] placeholder-[#6B7259]/50 focus:outline-none focus:border-[#B8874B] transition-colors"
            />
          </div>

          <div>
            <label className="block font-inter text-[11px] font-semibold uppercase tracking-wider text-[#6B7259] mb-1">
              Mobile Number <span className="text-[#B8874B]">*</span>
            </label>
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 9876543210 (10-digit mobile)"
              className="w-full bg-[#FAF7F2]/50 border border-[#E4DDD1] px-3.5 py-2.5 text-sm text-[#2B2420] placeholder-[#6B7259]/50 focus:outline-none focus:border-[#B8874B] transition-colors"
            />
          </div>

          {/* Read-only Checked Area / Pincode Reference */}
          <div>
            <label className="block font-inter text-[11px] font-semibold uppercase tracking-wider text-[#6B7259] mb-1">
              Delivery Area / Pincode
            </label>
            <div className="bg-[#FAF7F2] border border-[#E4DDD1] px-3.5 py-2.5 text-xs flex items-center justify-between">
              {areaInput.trim() ? (
                <span className="text-[#2B2420] font-medium">
                  Checked area: <strong className="text-[#4A3728]">{areaInput.trim()}</strong>
                </span>
              ) : (
                <span className="text-[#6B7259] italic">
                  No area checked yet — please type your area/pincode in the checker above
                </span>
              )}
              {checkResult?.checked && (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                    checkResult.isDeliverable
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {checkResult.isDeliverable
                    ? `Available (${checkResult.zoneName || 'Zone'} - ₹${formatPrice(checkResult.fee || 0)})`
                    : 'Pickup Only'}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block font-inter text-[11px] font-semibold uppercase tracking-wider text-[#6B7259] mb-1">
              House / Flat No., Building Name <span className="text-[#B8874B]">*</span>
            </label>
            <input
              type="text"
              required
              value={doorFlatBuilding}
              onChange={(e) => setDoorFlatBuilding(e.target.value)}
              placeholder="e.g. Flat 402, Oakwood Apartments"
              className="w-full bg-[#FAF7F2]/50 border border-[#E4DDD1] px-3.5 py-2.5 text-sm text-[#2B2420] placeholder-[#6B7259]/50 focus:outline-none focus:border-[#B8874B] transition-colors"
            />
          </div>

          <div>
            <label className="block font-inter text-[11px] font-semibold uppercase tracking-wider text-[#6B7259] mb-1">
              Street / Locality / Landmark <span className="text-[#B8874B]">*</span>
            </label>
            <input
              type="text"
              required
              value={streetLocality}
              onChange={(e) => setStreetLocality(e.target.value)}
              placeholder="e.g. Near Inorbit Mall, Mindspace Road"
              className="w-full bg-[#FAF7F2]/50 border border-[#E4DDD1] px-3.5 py-2.5 text-sm text-[#2B2420] placeholder-[#6B7259]/50 focus:outline-none focus:border-[#B8874B] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#4A3728] text-[#FAF7F2] font-inter text-xs font-semibold uppercase tracking-widest hover:bg-[#B8874B] disabled:opacity-50 transition-colors duration-300"
          >
            {submitting ? (
              <span>Submitting Enquiry...</span>
            ) : (
              <>
                <svg
                  className="w-4 h-4 shrink-0 fill-current"
                  viewBox="0 0 24 24"
                >
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                <span>Submit & Chat on WhatsApp</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
