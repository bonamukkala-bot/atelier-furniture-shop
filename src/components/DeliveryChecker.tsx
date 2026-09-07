import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { CONTACT_PHONE } from '../pages/StorefrontPage'
import { useToast } from '../context/ToastContext'
import type { Product, DeliveryZone } from '../lib/types'
import {
  searchNominatim,
  reverseGeocodeNominatim,
  calculateHaversineDistanceKm,
  type NominatimPlace,
} from '../lib/nominatim'

interface DeliveryCheckerProps {
  product: Product
}

interface CheckResult {
  checked: boolean
  isDeliverable: boolean
  zoneId: string | null
  zoneName: string | null
  fee: number | null
  transitMinDays: number | null
  transitMaxDays: number | null
  distanceKm?: number | null
}

function formatPrice(price: number): string {
  return Math.round(Number(price)).toLocaleString('en-IN')
}

export default function DeliveryChecker({ product }: DeliveryCheckerProps) {
  const { showToast } = useToast()

  // ── Shop settings & zones ──
  const [deliveryEnabled, setDeliveryEnabled] = useState<boolean | null>(null)
  const [prepDays, setPrepDays] = useState<number>(3)
  const [workshopLat, setWorkshopLat] = useState<number>(17.4375) // Default Atelier studio Jubilee Hills
  const [workshopLng, setWorkshopLng] = useState<number>(78.3975)
  const [dbZones, setDbZones] = useState<DeliveryZone[]>([])
  const [loadingZones, setLoadingZones] = useState(true)

  // ── Address search & coordinate state (OpenStreetMap Nominatim) ──
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimPlace[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<NominatimPlace | null>(null)
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [resolvedAddress, setResolvedAddress] = useState('')
  const [pincodeInput, setPincodeInput] = useState('')
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)

  // Dropdown click outside ref
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  // ── Enquiry form state ──
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [doorFlatBuilding, setDoorFlatBuilding] = useState('')
  const [streetLocality, setStreetLocality] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // ── Initial load: shop_settings & delivery_zones ──
  useEffect(() => {
    async function loadData() {
      try {
        const [{ data: zonesData }, { data: settingsData }] = await Promise.all([
          supabase.from('delivery_zones').select('*').order('max_distance_km', { ascending: true }),
          supabase
            .from('shop_settings')
            .select('delivery_enabled, prep_days, workshop_lat, workshop_lng, workshop_address')
            .eq('id', 1)
            .maybeSingle(),
        ])

        if (zonesData) {
          setDbZones(zonesData)
        }

        if (settingsData) {
          if (settingsData.delivery_enabled !== undefined && settingsData.delivery_enabled !== null) {
            setDeliveryEnabled(settingsData.delivery_enabled)
          } else {
            setDeliveryEnabled(true)
          }
          if (settingsData.prep_days !== undefined && settingsData.prep_days !== null) {
            setPrepDays(settingsData.prep_days)
          }
          if (settingsData.workshop_lat !== undefined && settingsData.workshop_lat !== null) {
            setWorkshopLat(Number(settingsData.workshop_lat))
          }
          if (settingsData.workshop_lng !== undefined && settingsData.workshop_lng !== null) {
            setWorkshopLng(Number(settingsData.workshop_lng))
          }
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

  // ── Debounced Nominatim address search ──
  useEffect(() => {
    const trimmed = searchQuery.trim()

    // Don't search if too short or if matching the already selected suggestion
    if (!trimmed || trimmed.length < 3) {
      setSuggestions([])
      setIsSearching(false)
      setHasSearched(false)
      return
    }

    if (selectedPlace && trimmed === selectedPlace.displayName) {
      return
    }

    setIsSearching(true)
    const timer = setTimeout(async () => {
      const results = await searchNominatim(trimmed)
      setSuggestions(results)
      setIsSearching(false)
      setHasSearched(true)
      setShowDropdown(true)
    }, 450)

    return () => clearTimeout(timer)
  }, [searchQuery, selectedPlace])

  // ── Handle outside click to close dropdown ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Zone evaluation logic: Haversine distance with text fallback ──
  const evaluateDelivery = (
    lat: number | null,
    lon: number | null,
    textQuery: string
  ): CheckResult => {
    // 1. Primary: Distance-based calculation from workshop origin
    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
      const distance = calculateHaversineDistanceKm(workshopLat, workshopLng, lat, lon)
      const roundedDistance = Number(distance.toFixed(1))

      // Sort zones by max_distance_km ascending
      const sortedZones = [...dbZones].sort((a, b) => (a.max_distance_km ?? 999) - (b.max_distance_km ?? 999))

      // Find the first zone whose max_distance_km covers this distance
      const matchedZone = sortedZones.find((z) => (z.max_distance_km ?? 0) >= distance)

      if (matchedZone) {
        return {
          checked: true,
          isDeliverable: true,
          zoneId: matchedZone.id,
          zoneName: matchedZone.zone_name,
          fee: matchedZone.fee,
          transitMinDays: matchedZone.transit_min_days ?? 2,
          transitMaxDays: matchedZone.transit_max_days ?? 4,
          distanceKm: roundedDistance,
        }
      }

      // Beyond all zone distances
      return {
        checked: true,
        isDeliverable: false,
        zoneId: null,
        zoneName: null,
        fee: null,
        transitMinDays: null,
        transitMaxDays: null,
        distanceKm: roundedDistance,
      }
    }

    // 2. Secondary/Fallback: Text & Pincode matching (if user typed without coordinates)
    const rawTrimmed = textQuery.trim()
    const query = rawTrimmed.toLowerCase()
    if (!query) {
      return {
        checked: false,
        isDeliverable: false,
        zoneId: null,
        zoneName: null,
        fee: null,
        transitMinDays: null,
        transitMaxDays: null,
      }
    }

    const pincodeMatch = rawTrimmed.match(/\b\d{6}\b/)
    const pincode = /^\d{6}$/.test(rawTrimmed) ? rawTrimmed : pincodeMatch ? pincodeMatch[0] : null

    if (pincode) {
      for (const zone of dbZones) {
        const zonePincodes = zone.pincodes || []
        if (zonePincodes.some((p) => p.trim() === pincode)) {
          return {
            checked: true,
            isDeliverable: true,
            zoneId: zone.id,
            zoneName: zone.zone_name,
            fee: zone.fee,
            transitMinDays: zone.transit_min_days ?? 2,
            transitMaxDays: zone.transit_max_days ?? 4,
          }
        }
      }
    }

    for (const zone of dbZones) {
      const areas = zone.area_names || []
      const isMatch = areas.some((area) => {
        const cleanArea = area.trim().toLowerCase()
        return cleanArea && (query.includes(cleanArea) || cleanArea.includes(query))
      })

      if (isMatch) {
        return {
          checked: true,
          isDeliverable: true,
          zoneId: zone.id,
          zoneName: zone.zone_name,
          fee: zone.fee,
          transitMinDays: zone.transit_min_days ?? 2,
          transitMaxDays: zone.transit_max_days ?? 4,
        }
      }
    }

    return {
      checked: true,
      isDeliverable: false,
      zoneId: null,
      zoneName: null,
      fee: null,
      transitMinDays: null,
      transitMaxDays: null,
    }
  }

  // ── Handle suggestion selection from dropdown ──
  const handleSelectSuggestion = (place: NominatimPlace) => {
    setSelectedPlace(place)
    setSearchQuery(place.displayName)
    setResolvedAddress(place.displayName)
    setLatitude(place.lat)
    setLongitude(place.lon)
    if (place.pincode) {
      setPincodeInput(place.pincode)
    }
    setShowDropdown(false)
    setLocationError('')

    // Evaluate zone immediately upon selecting an address
    const result = evaluateDelivery(place.lat, place.lon, place.displayName)
    setCheckResult(result)
  }

  // ── Handle "Use My Current Location" (Browser Geolocation + Nominatim Reverse) ──
  const handleGetCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser.'
      setLocationError(msg)
      showToast(msg, 'error')
      return
    }

    setIsLocating(true)
    setLocationError('')
    setShowDropdown(false)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords

        try {
          // Call Nominatim reverse geocoding
          const place = await reverseGeocodeNominatim(lat, lon)

          if (place) {
            setSelectedPlace(place)
            setSearchQuery(place.displayName)
            setResolvedAddress(place.displayName)
            setLatitude(place.lat)
            setLongitude(place.lon)
            if (place.pincode) {
              setPincodeInput(place.pincode)
            }
            const result = evaluateDelivery(place.lat, place.lon, place.displayName)
            setCheckResult(result)
            showToast('Current location detected successfully!', 'success')
          } else {
            // Fallback with raw GPS coordinates if reverse geocoding text is empty
            const fallbackLabel = `Current Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`
            setSearchQuery(fallbackLabel)
            setResolvedAddress(fallbackLabel)
            setLatitude(lat)
            setLongitude(lon)
            const result = evaluateDelivery(lat, lon, fallbackLabel)
            setCheckResult(result)
            showToast('Coordinates captured from GPS!', 'success')
          }
        } catch (err) {
          console.error('Error reverse geocoding location:', err)
          showToast('Failed to resolve address name, but coordinates captured.', 'info')
        } finally {
          setIsLocating(false)
        }
      },
      (error) => {
        setIsLocating(false)
        let errorMsg = 'Unable to retrieve your location.'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Location access denied — please search your address instead.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Location information is unavailable — please search your address instead.'
            break
          case error.TIMEOUT:
            errorMsg = 'Location request timed out — please search your address instead.'
            break
        }
        setLocationError(errorMsg)
        showToast(errorMsg, 'error')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  }

  // ── Handle Check button click / form submit ──
  const handleCheckDelivery = (e: React.FormEvent) => {
    e.preventDefault()
    const targetText = pincodeInput.trim() || searchQuery.trim()
    if (!targetText && latitude === null) return

    setShowDropdown(false)
    const result = evaluateDelivery(latitude, longitude, targetText)
    setCheckResult(result)
  }

  // ── Handle Enquiry Submit ──
  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSubmitSuccess(false)

    const trimmedName = customerName.trim()
    const trimmedDoor = doorFlatBuilding.trim()
    const trimmedStreet = streetLocality.trim()
    const finalAreaText = (resolvedAddress || searchQuery || pincodeInput).trim()

    if (!trimmedName) {
      setFormError('Please enter your full name.')
      return
    }

    // Strict Indian mobile validation (10 digits starting with 6-9)
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

    if (!trimmedDoor || trimmedDoor.length < 4) {
      setFormError('Enter a valid House/Flat No., Building Name (min 4 characters).')
      return
    }

    if (!trimmedStreet || trimmedStreet.length < 4) {
      setFormError('Enter a valid Street / Locality / Landmark (min 4 characters).')
      return
    }

    if (!finalAreaText) {
      setFormError('Please search and select your delivery address / area above first.')
      return
    }

    // Determine deliverability and zone
    let activeResult = checkResult
    if (!activeResult || !activeResult.checked) {
      activeResult = evaluateDelivery(latitude, longitude, finalAreaText)
    }

    setSubmitting(true)

    try {
      // Insert enquiry record with coordinates & calculated distance
      const { error: insertError } = await supabase.from('delivery_enquiries').insert({
        product_id: product.id,
        customer_name: trimmedName,
        phone: cleanedPhone,
        door_flat_building: trimmedDoor,
        street_locality: trimmedStreet,
        area_text: finalAreaText,
        zone_id: activeResult.zoneId,
        is_deliverable: activeResult.isDeliverable,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        distance_km: activeResult.distanceKm ?? null,
      })

      if (insertError) {
        console.error('Delivery enquiry insert error:', insertError)
        throw new Error(insertError.message || 'Unable to save enquiry.')
      }

      setSubmitSuccess(true)
      showToast('Enquiry submitted successfully! Opening WhatsApp...', 'success')

      // Compose WhatsApp message
      const shopPhone = CONTACT_PHONE.replace(/\D/g, '')
      const estMin = prepDays + (activeResult.transitMinDays ?? 2)
      const estMax = prepDays + (activeResult.transitMaxDays ?? 4)
      const distanceNotice =
        activeResult.distanceKm !== undefined && activeResult.distanceKm !== null
          ? ` (${activeResult.distanceKm} km from workshop)`
          : ''
      const deliveryStatusText = activeResult.isDeliverable
        ? `Delivery available — ₹${formatPrice(activeResult.fee || 0)}${distanceNotice}\nEstimated delivery: ${estMin}-${estMax} days from order confirmation`
        : `Outside standard delivery area${distanceNotice} (Workshop pickup available)`

      const fullAddress = `${trimmedDoor}, ${trimmedStreet}, ${finalAreaText}`
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
          Check real delivery availability and distance from our workshop in Hyderabad.
        </p>
      </div>

      {/* ── Delivery Checker Box ──────────────────────────────────────── */}
      <div className="bg-[#FAF7F2] border border-[#E4DDD1] p-5 sm:p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label
            htmlFor="address-search-input"
            className="block font-inter text-[11px] font-semibold uppercase tracking-wider text-[#4A3728]"
          >
            Search your address or neighborhood
          </label>

          {/* "Use My Current Location" button */}
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={isLocating || loadingZones}
            title="Detect your current location using device GPS"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E4DDD1] text-[#4A3728] hover:border-[#B8874B] hover:text-[#B8874B] text-[11px] font-inter font-medium rounded-sm transition-colors duration-150 disabled:opacity-50 cursor-pointer"
          >
            {isLocating ? (
              <svg
                className="animate-spin h-3.5 w-3.5 text-[#B8874B]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 text-[#B8874B]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
              </svg>
            )}
            <span>{isLocating ? 'Detecting Location...' : 'Use My Current Location'}</span>
          </button>
        </div>

        {locationError && (
          <div className="mb-3 text-xs text-[#A84B3B] bg-red-50 border border-red-200 px-3 py-2 rounded-sm flex items-center justify-between font-inter">
            <span>{locationError}</span>
            <button
              type="button"
              onClick={() => setLocationError('')}
              className="text-[#A84B3B] hover:text-[#2B2420] font-bold text-xs ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="relative" ref={dropdownRef}>
          <form onSubmit={handleCheckDelivery} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B8874B] pointer-events-none">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>

                <input
                  id="address-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    if (selectedPlace && e.target.value !== selectedPlace.displayName) {
                      setSelectedPlace(null)
                      setLatitude(null)
                      setLongitude(null)
                      setResolvedAddress('')
                    }
                    if (checkResult) setCheckResult(null)
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowDropdown(true)
                  }}
                  placeholder="Search your address, road, or nearby landmark (e.g. Jubilee Hills Road 36)..."
                  className="w-full bg-white border border-[#E4DDD1] pl-10 pr-10 py-2.5 text-sm text-[#2B2420] placeholder-[#6B7259]/60 focus:outline-none focus:border-[#B8874B] transition-colors"
                  autoComplete="off"
                />

                {/* Loading indicator inside input */}
                {isSearching && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <svg
                      className="animate-spin h-4 w-4 text-[#B8874B]"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={(!searchQuery.trim() && !pincodeInput.trim()) || loadingZones || isSearching}
                className="px-5 py-2.5 bg-[#4A3728] text-[#FAF7F2] font-inter text-xs font-semibold uppercase tracking-wider hover:bg-[#B8874B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shrink-0 cursor-pointer"
              >
                Check
              </button>
            </div>

            {/* Secondary / Fallback Pincode & Coordinate Tag */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-inter text-[#6B7259] pt-1">
              <div className="flex items-center gap-2">
                <label htmlFor="pincode-fallback-input" className="text-[11px] font-medium text-[#4A3728]">
                  Pincode (Fallback / Manual Reference):
                </label>
                <input
                  id="pincode-fallback-input"
                  type="text"
                  maxLength={6}
                  value={pincodeInput}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setPincodeInput(cleaned)
                    if (checkResult) setCheckResult(null)
                  }}
                  placeholder="e.g. 500033"
                  className="w-24 bg-white border border-[#E4DDD1] px-2.5 py-1 text-xs text-[#2B2420] placeholder-[#6B7259]/50 focus:outline-none focus:border-[#B8874B]"
                />
              </div>

              {latitude !== null && longitude !== null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-sm text-[11px] font-medium">
                  <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Coordinates resolved ({latitude.toFixed(4)}, {longitude.toFixed(4)})
                </span>
              )}
            </div>
          </form>

          {/* Autocomplete Dropdown */}
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E4DDD1] shadow-lg rounded-sm z-30 max-h-60 overflow-y-auto">
              {suggestions.length > 0 ? (
                <ul className="divide-y divide-[#F0EBE4]">
                  {suggestions.map((place) => (
                    <li key={place.placeId}>
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(place)}
                        className="w-full text-left px-4 py-3 text-xs text-[#2B2420] hover:bg-[#FAF7F2] transition-colors flex items-start gap-2.5 cursor-pointer"
                      >
                        <svg
                          className="w-3.5 h-3.5 mt-0.5 text-[#B8874B] shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <div className="flex-1">
                          <span className="font-medium text-[#2B2420] block leading-snug">
                            {place.displayName}
                          </span>
                          {place.pincode && (
                            <span className="text-[10px] text-[#6B7259] mt-0.5 block">
                              Pincode: {place.pincode}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : hasSearched && !isSearching && searchQuery.trim().length >= 3 ? (
                <div className="p-4 text-xs text-[#6B7259] font-inter">
                  <div className="flex items-start gap-2.5">
                    <svg
                      className="w-4 h-4 text-[#B8874B] shrink-0 mt-0.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div>
                      <p className="font-semibold text-[#4A3728] mb-1">
                        Can't find that exact building
                      </p>
                      <p className="text-[11px] text-[#6B7259] leading-relaxed">
                        Try searching the nearest main road or landmark instead (e.g. <em>'near Gachibowli flyover'</em>), use <strong>"Use My Current Location"</strong> above, or enter your 6-digit pincode below.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Checker Result Card */}
        {checkResult && checkResult.checked && (
          <div className="mt-4 pt-4 border-t border-[#E4DDD1]/80">
            {checkResult.isDeliverable ? (
              <div className="flex flex-col gap-1.5 text-emerald-800 bg-emerald-50/80 border border-emerald-200/80 px-4 py-3 rounded-sm">
                <div className="flex items-center gap-2.5">
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
                  <span className="font-inter text-xs sm:text-sm font-semibold">
                    Delivery available — ₹{formatPrice(checkResult.fee || 0)}
                    {checkResult.zoneName && (
                      <span className="text-emerald-700/80 text-xs ml-1.5 font-normal">
                        ({checkResult.zoneName}
                        {checkResult.distanceKm !== undefined && checkResult.distanceKm !== null
                          ? ` • ${checkResult.distanceKm} km from workshop`
                          : ''}
                        )
                      </span>
                    )}
                  </span>
                </div>
                <div className="font-inter text-xs text-emerald-900/90 pl-6.5 font-medium">
                  Estimated delivery: {prepDays + (checkResult.transitMinDays ?? 2)}–
                  {prepDays + (checkResult.transitMaxDays ?? 4)} days from order confirmation.
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 text-[#4A3728] bg-[#FAF7F2] border border-[#E4DDD1] px-4 py-3 rounded-sm">
                <svg
                  className="w-4 h-4 shrink-0 text-[#B8874B] mt-0.5"
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
                <div className="text-xs sm:text-sm font-medium text-[#2B2420]">
                  Outside our standard delivery area
                  {checkResult.distanceKm !== undefined && checkResult.distanceKm !== null
                    ? ` (${checkResult.distanceKm} km from workshop)`
                    : ''}
                  , studio/workshop pickup available.
                </div>
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
              Delivery Area / Address
            </label>
            <div className="bg-[#FAF7F2] border border-[#E4DDD1] px-3.5 py-2.5 text-xs flex items-center justify-between">
              {resolvedAddress || searchQuery || pincodeInput ? (
                <span className="text-[#2B2420] font-medium">
                  Selected area:{' '}
                  <strong className="text-[#4A3728]">
                    {resolvedAddress || searchQuery || `Pincode: ${pincodeInput}`}
                  </strong>
                </span>
              ) : (
                <span className="text-[#6B7259] italic">
                  No address checked yet — please search your address in the checker above
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
                    ? `Available (${checkResult.zoneName || 'Zone'} - ₹${formatPrice(checkResult.fee || 0)} | Est: ${prepDays + (checkResult.transitMinDays ?? 2)}–${prepDays + (checkResult.transitMaxDays ?? 4)} days)`
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
              placeholder="e.g. Flat 402, Oakwood Residency"
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
              placeholder="e.g. Near Durgam Cheruvu Metro Station, Road 36"
              className="w-full bg-[#FAF7F2]/50 border border-[#E4DDD1] px-3.5 py-2.5 text-sm text-[#2B2420] placeholder-[#6B7259]/50 focus:outline-none focus:border-[#B8874B] transition-colors"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#4A3728] text-[#FAF7F2] font-inter text-xs font-semibold uppercase tracking-wider py-3.5 px-6 hover:bg-[#B8874B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
            >
              {submitting ? 'Submitting Enquiry...' : 'Submit Delivery Enquiry & Open WhatsApp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
