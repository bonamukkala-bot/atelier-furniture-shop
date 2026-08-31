export interface ImageTransformOptions {
  width?: number
  height?: number
  quality?: number
  resize?: 'cover' | 'contain' | 'fill'
  format?: 'origin' | 'avif' | 'webp'
}

/**
 * Generates an optimized Supabase storage image URL using Supabase's image transformation API.
 * Converts `/storage/v1/object/public/` to `/storage/v1/render/image/public/` and appends transform parameters.
 * Non-Supabase storage URLs or invalid URLs are returned unmodified.
 *
 * @param url The raw image URL from Supabase Storage
 * @param widthOrOptions Either the target width in pixels or a full options object
 * @param quality Optional quality (1-100), used when width is passed as a number
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  widthOrOptions?: number | ImageTransformOptions,
  quality?: number
): string {
  if (!url || typeof url !== 'string') return ''

  let options: ImageTransformOptions = {}
  if (typeof widthOrOptions === 'number') {
    options = { width: widthOrOptions, quality }
  } else if (widthOrOptions && typeof widthOrOptions === 'object') {
    options = widthOrOptions
  }

  const { width, height, quality: optQuality, resize, format } = options

  // If no transformations requested, return original URL
  if (!width && !height && !optQuality && !resize && !format) {
    return url
  }

  try {
    const isSupabasePublic = url.includes('/storage/v1/object/public/')
    const isSupabaseSign = url.includes('/storage/v1/object/sign/')
    const isSupabaseRender = url.includes('/storage/v1/render/image/')

    if (!isSupabasePublic && !isSupabaseSign && !isSupabaseRender) {
      return url
    }

    let transformedUrl = url
    if (isSupabasePublic) {
      transformedUrl = transformedUrl.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    } else if (isSupabaseSign) {
      transformedUrl = transformedUrl.replace('/storage/v1/object/sign/', '/storage/v1/render/image/sign/')
    }

    const parsed = new URL(transformedUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')

    if (width) parsed.searchParams.set('width', width.toString())
    if (height) parsed.searchParams.set('height', height.toString())
    if (optQuality) parsed.searchParams.set('quality', optQuality.toString())
    if (resize) parsed.searchParams.set('resize', resize)
    if (format) parsed.searchParams.set('format', format)

    return parsed.toString()
  } catch {
    return url
  }
}
