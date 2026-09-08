import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { CONTACT_PHONE } from './StorefrontPage'
import LanguageToggle from '../components/LanguageToggle'
import type { DeliveryStatusHistory, DeliveryZone } from '../lib/types'

interface TrackingOrder {
  id: string
  product_id?: string
  customer_name?: string
  delivery_status?: string
  delivery_address?: string | null
  delivery_fee?: number | null
  delivery_zone_id?: string | null
  total?: number | null
  payment_status?: string | null
  deposit_amount?: number | null
  delivery_partner_id?: string | null
  delivery_partner_name?: string | null
  delivery_partner_phone?: string | null
  tracking_token?: string | null
  delivery_confirmation_code?: string | null
  delivery_confirmed_via?: string | null
  partner_accepted_at?: string | null
  created_at?: string
  updated_at?: string | null
}

interface TrackingProduct {
  id: string
  name: string
  price: number
  image_url: string | null
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN').format(price)
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return dateStr
  }
}

const STEPS = [
  { key: 'confirmed', label: 'Confirmed', desc: 'Order received & scheduled' },
  { key: 'preparing', label: 'Preparing', desc: 'Handcrafting & packing in studio' },
  { key: 'assigned', label: 'Assigned for Delivery', desc: 'A delivery partner has been assigned to your order' },
  { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'In transit to your doorstep' },
  { key: 'delivered', label: 'Delivered', desc: 'Delivered safely to you' },
]

export default function OrderTrackingPage() {
  const { tracking_token } = useParams<{ tracking_token: string }>()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<TrackingOrder | null>(null)
  const [product, setProduct] = useState<TrackingProduct | null>(null)
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZone | null>(null)
  const [prepDays, setPrepDays] = useState<number>(3)
  const [history, setHistory] = useState<DeliveryStatusHistory[]>([])

  useEffect(() => {
    if (!tracking_token) {
      setError('No tracking token provided.')
      setLoading(false)
      return
    }

    // Initial load (shows spinner)
    loadTrackingData(tracking_token, false)

    // Background live-sync: Poll every 10 seconds via secure token RPC
    const intervalId = setInterval(() => {
      loadTrackingData(tracking_token, true)
    }, 10000)

    return () => {
      clearInterval(intervalId)
    }
  }, [tracking_token])

  async function loadTrackingData(token: string, silent = false) {
    if (!silent) {
      setLoading(true)
      setError(null)
    }

    try {
      // 1. Call get_order_by_tracking_token RPC
      const { data, error: rpcError } = await supabase.rpc('get_order_by_tracking_token', {
        p_token: token,
      })

      if (rpcError || !data) {
        if (!silent) {
          setError('Order not found or tracking token invalid.')
          setOrder(null)
          setLoading(false)
        }
        return
      }

      const orderResult: TrackingOrder = Array.isArray(data) ? data[0] : data
      if (!orderResult) {
        if (!silent) {
          setError('Order not found or tracking token invalid.')
          setOrder(null)
          setLoading(false)
        }
        return
      }

      setOrder(orderResult)

      // Fetch shop settings for prep days
      try {
        const { data: settingsData } = await supabase
          .from('shop_settings')
          .select('prep_days')
          .eq('id', 1)
          .maybeSingle()
        if (settingsData && settingsData.prep_days !== undefined && settingsData.prep_days !== null) {
          setPrepDays(settingsData.prep_days)
        }
      } catch (settingsErr) {
        console.warn('Could not fetch prep days:', settingsErr)
      }

      // Fetch delivery zone if delivery_zone_id is present
      if (orderResult.delivery_zone_id) {
        try {
          const { data: zoneData } = await supabase
            .from('delivery_zones')
            .select('*')
            .eq('id', orderResult.delivery_zone_id)
            .maybeSingle()
          if (zoneData) {
            setDeliveryZone(zoneData)
          }
        } catch (zoneErr) {
          console.warn('Could not fetch delivery zone details:', zoneErr)
        }
      }

      // 2. Fetch product details if product_id is available
      if (orderResult.product_id) {
        try {
          const { data: prodData } = await supabase
            .from('products')
            .select('id, name, price, image_url')
            .eq('id', orderResult.product_id)
            .maybeSingle()

          if (prodData) {
            let primaryImg = prodData.image_url
            const { data: imgData } = await supabase
              .from('product_images')
              .select('image_url')
              .eq('product_id', prodData.id)
              .order('sort_order', { ascending: true })
              .limit(1)

            if (imgData && imgData.length > 0 && imgData[0].image_url) {
              primaryImg = imgData[0].image_url
            }

            setProduct({
              id: prodData.id,
              name: prodData.name,
              price: prodData.price,
              image_url: primaryImg,
            })
          }
        } catch (prodErr) {
          console.warn('Could not fetch product details:', prodErr)
        }
      }

      // 3. Fetch status history via get_delivery_history_by_tracking_token RPC
      try {
        const { data: histData, error: histErr } = await supabase.rpc(
          'get_delivery_history_by_tracking_token',
          { p_token: token }
        )

        let historyResult: DeliveryStatusHistory[] = []
        if (!histErr && histData && Array.isArray(histData)) {
          historyResult = histData
        }

        // Sort oldest to newest (changed_at ascending)
        historyResult.sort((a, b) => {
          const tA = new Date(a.changed_at || (a as any).created_at || 0).getTime()
          const tB = new Date(b.changed_at || (b as any).created_at || 0).getTime()
          return tA - tB
        })

        setHistory(historyResult)
      } catch (histErr) {
        console.warn('Could not fetch delivery history:', histErr)
      }
    } catch (err: any) {
      console.error('Unexpected error loading tracking info:', err)
      setError(err?.message || 'Failed to load tracking info.')
    } finally {
      setLoading(false)
    }
  }

  // ── Loading State ──
  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAF7F2] flex items-center justify-center font-inter text-sm text-[#6B7259]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#B8874B] border-t-transparent rounded-full animate-spin" />
          <span>Locating your Atelier delivery...</span>
        </div>
      </main>
    )
  }

  // ── On-brand Not Found / Error State ──
  if (error || !order) {
    return (
      <main className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center gap-5 px-4 text-center">
        <h1 className="font-fraunces text-3xl sm:text-4xl text-[#2B2420]">
          Tracking Information Not Found
        </h1>
        <p className="text-[#6B7259] max-w-xl text-sm sm:text-base leading-relaxed">
          We couldn't locate an active delivery matching this tracking reference. Please double-check
          the link in your WhatsApp message, or reach out to our studio team for assistance.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 justify-center items-center">
          <Link
            to="/"
            className="inline-block bg-[#B8874B] text-white px-6 py-2.5 text-sm font-semibold hover:bg-[#4A3728] transition-colors"
          >
            Explore Collection
          </Link>
          <button
            onClick={() => {
              const phone = CONTACT_PHONE.replace(/\D/g, '')
              window.open(
                `https://wa.me/${phone}?text=${encodeURIComponent(
                  `Hi Atelier! I am having trouble tracking my order with link token: ${tracking_token}`
                )}`,
                '_blank',
                'noopener,noreferrer'
              )
            }}
            className="border border-[#E4DDD1] px-5 py-2.5 text-sm font-semibold text-[#2B2420] hover:bg-[#F2ECE1] transition-colors"
          >
            Contact Studio via WhatsApp
          </button>
        </div>
      </main>
    )
  }

  const currentStatus = (order.delivery_status || 'confirmed').toLowerCase()
  const isIssue = currentStatus === 'issue'
  const isDelivered = currentStatus === 'delivered'
  const isOutForDelivery = currentStatus === 'out_for_delivery'
  const isPartnerAccepted = Boolean(order.partner_accepted_at)

  let currentStepIndex = 0
  if (isIssue) {
    currentStepIndex = -1
  } else if (isDelivered) {
    currentStepIndex = 4
  } else if (isOutForDelivery) {
    currentStepIndex = 3
  } else if (isPartnerAccepted) {
    currentStepIndex = 2
  } else if (currentStatus === 'preparing' || order.delivery_partner_id || order.delivery_partner_name) {
    currentStepIndex = 1
  } else {
    currentStepIndex = 0
  }

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#2B2420]">
      {/* ── Studio Header ── */}
      <header className="border-b border-[#E4DDD1] bg-[#FAF7F2] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="font-fraunces text-xl sm:text-2xl font-semibold tracking-tight text-[#2B2420]"
          >
            ATELIER
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link
              to="/#collection"
              className="text-[10px] sm:text-xs font-inter font-semibold uppercase tracking-widest text-[#6B7259] hover:text-[#B8874B] transition-colors"
            >
              Collection
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Tracking Container ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Eyebrow & Title */}
        <div className="mb-8 text-center sm:text-left">
          <span className="text-[11px] font-inter font-semibold uppercase tracking-widest text-[#B8874B] block mb-1">
            Order Status & Tracking
          </span>
          <h1 className="font-fraunces text-2xl sm:text-3xl text-[#2B2420]">
            Track Your Delivery
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7259] mt-1 font-inter">
            Tracking Reference: <span className="font-mono text-[#2B2420]">{order.tracking_token || order.id}</span>
          </p>
        </div>

        {/* ── Issue Alert State (if status is 'issue') ── */}
        {isIssue && (
          <div
            className="mb-8 p-5 sm:p-6 bg-[#FEF2F2] border border-[#FECACA] rounded-sm text-left shadow-xs"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FEE2E2] flex items-center justify-center shrink-0 mt-0.5 text-[#DC2626]">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-[#991B1B] font-inter">
                  Delivery Attention Required
                </h2>
                <p className="text-sm text-[#B91C1C] mt-1 leading-relaxed">
                  There has been an unexpected delay or route update regarding your delivery. Our studio
                  craftsmen and dispatch team are actively looking into this.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      const phone = CONTACT_PHONE.replace(/\D/g, '')
                      window.open(
                        `https://wa.me/${phone}?text=${encodeURIComponent(
                          `Hi Atelier! I am checking on my delivery issue for order ref: ${
                            order.tracking_token || order.id
                          }`
                        )}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }}
                    className="inline-flex items-center gap-2 bg-[#DC2626] text-white px-4 py-2 text-xs font-semibold hover:bg-[#B91C1C] transition-colors"
                  >
                    Chat With Us On WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step Tracker Card ── */}
        <section className="bg-white border border-[#E4DDD1] p-6 sm:p-8 mb-8 shadow-xs">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs uppercase tracking-widest font-semibold text-[#6B7259] font-inter">
              Delivery Progress
            </h2>
            {isIssue && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
                Delivery Paused
              </span>
            )}
          </div>

          <div className="relative">
            {/* Steps Container */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 relative z-10">
              {STEPS.map((step, idx) => {
                const isCompleted = !isIssue && (isDelivered ? idx <= currentStepIndex : idx < currentStepIndex)
                const isActive = !isIssue && !isDelivered && currentStepIndex === idx

                return (
                  <div key={step.key} className="flex flex-col items-center text-center">
                    {/* Step Icon / Circle */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 ${
                        isCompleted
                          ? 'bg-[#B8874B] text-white'
                          : isActive
                          ? 'bg-[#FAF7F2] border-2 border-[#B8874B] text-[#B8874B] ring-4 ring-[#B8874B]/20'
                          : 'bg-[#FAF7F2] border border-[#E4DDD1] text-[#A0988A]'
                      }`}
                    >
                      {isCompleted ? (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>

                    {/* Step Label */}
                    <div className="mt-3">
                      <p
                        className={`text-xs sm:text-sm font-semibold ${
                          isActive || isCompleted ? 'text-[#2B2420]' : 'text-[#8C827A]'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-[11px] text-[#6B7259] mt-0.5 max-w-[140px] leading-tight">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Delivery Confirmation Code (Visible ONLY when Out for Delivery) ── */}
        {(order.delivery_status || '').toLowerCase().trim() === 'out_for_delivery' && order.delivery_confirmation_code && (
          <div className="mb-8 p-6 sm:p-8 bg-[#FAF7F2] border-2 border-[#B8874B] text-center shadow-xs">
            <div className="inline-flex items-center gap-2 bg-[#B8874B]/15 text-[#8F632E] px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
              <svg className="w-4 h-4 text-[#8F632E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Delivery Confirmation Code</span>
            </div>

            <div className="font-mono text-3xl sm:text-4xl font-bold tracking-[0.3em] text-[#2B2420] my-2 select-all">
              {order.delivery_confirmation_code}
            </div>

            <p className="text-xs sm:text-sm text-[#6B7259] mt-2 max-w-md mx-auto leading-relaxed">
              Please share this 6-digit code with the delivery person <strong>only once your order has arrived</strong> and been inspected.
            </p>
          </div>
        )}

        {/* ── Order Details & Product Summary Grid ── */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Piece Information */}
          <section className="bg-white border border-[#E4DDD1] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-xs uppercase tracking-widest font-semibold text-[#6B7259] mb-4 font-inter">
                Selected Furniture Piece
              </h2>

              <div className="flex gap-4 items-center">
                {product?.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name || 'Furniture Piece'}
                    className="w-20 h-20 sm:w-24 sm:sum-24 object-cover border border-[#E4DDD1] bg-[#FAF7F2]"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#FAF7F2] border border-[#E4DDD1] flex items-center justify-center text-xs text-[#6B7259]">
                    Piece
                  </div>
                )}
                <div>
                  <h3 className="font-fraunces text-lg sm:text-xl text-[#2B2420]">
                    {product?.name || 'Custom Crafted Piece'}
                  </h3>
                  {product?.price ? (
                    <p className="font-inter text-sm font-semibold text-[#4A3728] mt-1">
                      ₹{formatPrice(product.price)}
                    </p>
                  ) : null}
                  {product?.id && (
                    <Link
                      to={`/product/${product.id}`}
                      className="inline-block text-[11px] font-semibold text-[#B8874B] hover:text-[#4A3728] underline underline-offset-4 mt-2"
                    >
                      View Piece in Collection →
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Payment / Deposit Notice if payment_status is 'paid' */}
            {order.payment_status === 'paid' && (
              <div className="mt-6 pt-4 border-t border-[#E4DDD1] bg-[#FAF7F2] p-3 text-xs text-[#2B2420]">
                <div className="flex items-center gap-2 font-semibold text-[#4A3728]">
                  <svg
                    className="w-4 h-4 text-[#B8874B]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>
                    Booking deposit received: ₹{formatPrice(order.deposit_amount || 0)}
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Delivery & Dispatch Details */}
          <section className="bg-white border border-[#E4DDD1] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-xs uppercase tracking-widest font-semibold text-[#6B7259] mb-4 font-inter">
                Delivery Details
              </h2>

              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#6B7259] block font-semibold">
                    Destination Address
                  </span>
                  <p className="text-[#2B2420] mt-0.5 leading-relaxed">
                    {order.delivery_address || 'Address registered with studio'}
                  </p>
                </div>

                {deliveryZone && (
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#6B7259] block font-semibold">
                      Estimated Delivery
                    </span>
                    <p className="text-[#2B2420] mt-0.5 font-medium">
                      Estimated delivery: {prepDays + (deliveryZone.transit_min_days ?? 2)}–{prepDays + (deliveryZone.transit_max_days ?? 4)} days from order confirmation.
                      {deliveryZone.zone_name ? (
                        <span className="text-xs text-[#6B7259] ml-1.5 font-normal">
                          ({deliveryZone.zone_name})
                        </span>
                      ) : null}
                    </p>
                  </div>
                )}

                {order.delivery_partner_name && (
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#6B7259] block font-semibold">
                      Assigned Courier / Partner
                    </span>
                    <p className="text-[#2B2420] mt-0.5">
                      {order.delivery_partner_name}
                      {order.delivery_partner_phone && (
                        <span className="text-[#6B7259] ml-2">({order.delivery_partner_phone})</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Studio Assistance Footer in card */}
            <div className="mt-6 pt-4 border-t border-[#E4DDD1] flex items-center justify-between text-xs">
              <span className="text-[#6B7259]">Need to adjust delivery?</span>
              <button
                onClick={() => {
                  const phone = CONTACT_PHONE.replace(/\D/g, '')
                  window.open(
                    `https://wa.me/${phone}?text=${encodeURIComponent(
                      `Hi Atelier, I'd like to ask a question regarding delivery for order: ${
                        order.tracking_token || order.id
                      }`
                    )}`,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }}
                className="text-[#B8874B] font-semibold hover:text-[#4A3728] transition-colors"
              >
                Chat on WhatsApp →
              </button>
            </div>
          </section>
        </div>

        {/* ── Status History Timeline (Oldest to Newest) ── */}
        <section className="bg-white border border-[#E4DDD1] p-6 sm:p-8 shadow-xs">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#E4DDD1]">
            <h2 className="text-xs uppercase tracking-widest font-semibold text-[#6B7259] font-inter">
              Delivery Activity Log
            </h2>
            <span className="text-[11px] text-[#8C827A]">Oldest to Newest</span>
          </div>

          {history.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#6B7259]">
              <p>No activity logs recorded yet. Your delivery is being scheduled.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-[#E4DDD1]">
              {history.map((hist, index) => {
                const isLast = index === history.length - 1
                const histStatus = hist.status || 'update'

                let badgeBg = 'bg-[#FAF7F2] text-[#4A3728] border-[#E4DDD1]'
                let badgeLabel = histStatus.replace(/_/g, ' ')

                if (histStatus === 'confirmed') {
                  badgeBg = 'bg-[#F2ECE1] text-[#4A3728] border-[#D9CEBF]'
                  badgeLabel = 'Order Confirmed'
                } else if (histStatus === 'preparing') {
                  badgeBg = 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                  badgeLabel = 'Preparing in Studio'
                } else if (histStatus === 'out_for_delivery') {
                  badgeBg = 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]'
                  badgeLabel = 'Out for Delivery'
                } else if (histStatus === 'delivered') {
                  badgeBg = 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]'
                  badgeLabel = 'Delivered'
                } else if (histStatus === 'issue') {
                  badgeBg = 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                  badgeLabel = 'Delivery Issue / Delay'
                }

                return (
                  <div key={hist.id || index} className="relative group">
                    {/* Dot on Timeline */}
                    <div
                      className={`absolute -left-[29px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-white transition-colors ${
                        isLast
                          ? 'border-[#B8874B] bg-[#B8874B] ring-2 ring-[#B8874B]/20'
                          : 'border-[#A0988A]'
                      }`}
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2.5 py-0.5 border rounded-xs ${badgeBg}`}
                        >
                          {badgeLabel}
                        </span>
                      </div>
                      <time className="text-[11px] text-[#6B7259] font-inter">
                        {formatDateTime(hist.changed_at || (hist as any).created_at)}
                      </time>
                    </div>

                    {hist.note && (
                      <p className="text-xs text-[#4A3728] bg-[#FAF7F2] border border-[#E4DDD1] p-2.5 mt-2 italic rounded-xs leading-relaxed">
                        "{hist.note}"
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
