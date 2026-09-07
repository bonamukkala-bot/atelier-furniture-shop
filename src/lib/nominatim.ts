/**
 * OpenStreetMap Nominatim Geocoding & Haversine Distance Calculations
 * Free, open-source geocoding with no API keys or billing required.
 */

export interface NominatimPlace {
  placeId: string | number
  displayName: string
  lat: number
  lon: number
  pincode: string | null
  type?: string
  rawAddress?: Record<string, string>
}

/**
 * Calculates the straight-line distance in kilometers between two GPS coordinates
 * using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 (degrees)
 * @param lon1 Longitude of point 1 (degrees)
 * @param lat2 Latitude of point 2 (degrees)
 * @param lon2 Longitude of point 2 (degrees)
 * @returns Distance in kilometers
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's mean radius in kilometers
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Extracts a 6-digit Indian pincode from Nominatim address object or display string.
 */
export function extractPincode(address?: Record<string, string>, displayName?: string): string | null {
  if (address?.postcode) {
    const clean = address.postcode.replace(/\D/g, '')
    if (clean.length === 6) return clean
  }
  if (displayName) {
    const match = displayName.match(/\b\d{6}\b/)
    if (match) return match[0]
  }
  return null
}

// Controller for cancelling in-flight searches when new input arrives
let currentAbortController: AbortController | null = null

/**
 * Searches OpenStreetMap Nominatim for address suggestions in India, biased towards Hyderabad.
 * Respects Nominatim's fair-use policy by using debouncing on client callers and identifying the app.
 *
 * @param query User-typed search text (min 3 characters)
 * @returns Array of matching NominatimPlace suggestions
 */
export async function searchNominatim(query: string): Promise<NominatimPlace[]> {
  const trimmed = query.trim()
  if (!trimmed || trimmed.length < 3) return []

  // Cancel any existing pending request
  if (currentAbortController) {
    currentAbortController.abort()
  }
  currentAbortController = new AbortController()

  // Construct URL biased towards Hyderabad bounding box & India country code
  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'in',
    // Hyderabad bounding box: left,top,right,bottom (lon_min, lat_max, lon_max, lat_min)
    viewbox: '78.15,17.65,78.70,17.15',
    bounded: '0', // 0 = prefer viewbox without strictly excluding nearby areas
  })

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`

  try {
    const response = await fetch(url, {
      signal: currentAbortController.signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    })

    if (!response.ok) {
      console.warn(`[Nominatim] API responded with status ${response.status}`)
      return []
    }

    const data = await response.json()
    if (!Array.isArray(data)) return []

    return data.map((item: any) => {
      const lat = parseFloat(item.lat)
      const lon = parseFloat(item.lon)
      const pincode = extractPincode(item.address, item.display_name)

      return {
        placeId: item.place_id,
        displayName: item.display_name,
        lat,
        lon,
        pincode,
        type: item.type,
        rawAddress: item.address,
      }
    })
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      // Ignored - superseded by newer keystroke
      return []
    }
    console.error('[Nominatim] Geocoding request failed:', err)
    return []
  }
}

/**
 * Reverse geocodes GPS coordinates to a readable address using OpenStreetMap Nominatim.
 *
 * @param lat Latitude (degrees)
 * @param lon Longitude (degrees)
 * @returns NominatimPlace or null
 */
export async function reverseGeocodeNominatim(lat: number, lon: number): Promise<NominatimPlace | null> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    format: 'json',
    addressdetails: '1',
  })

  const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    })

    if (!response.ok) {
      console.warn(`[Nominatim] Reverse geocode responded with status ${response.status}`)
      return null
    }

    const data = await response.json()
    if (!data || !data.display_name) return null

    const resolvedLat = parseFloat(data.lat) || lat
    const resolvedLon = parseFloat(data.lon) || lon
    const pincode = extractPincode(data.address, data.display_name)

    return {
      placeId: data.place_id ?? `${lat},${lon}`,
      displayName: data.display_name,
      lat: resolvedLat,
      lon: resolvedLon,
      pincode,
      type: data.type,
      rawAddress: data.address,
    }
  } catch (err) {
    console.error('[Nominatim] Reverse geocode request failed:', err)
    return null
  }
}

