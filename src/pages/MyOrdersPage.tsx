import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import CustomerAccountControl from '../components/CustomerAccountControl'
import LanguageToggle from '../components/LanguageToggle'

interface MyOrderRow {
  order_id: string
  product_name: string | null
  product_image_url: string | null
  quantity: number | null
  total: number | string | null
  delivery_fee: number | string | null
  delivery_status: string | null
  delivery_address: string | null
  zone_name: string | null
  order_date: string | null
  created_at: string | null
  updated_at: string | null
  tracking_token: string | null
}

function formatIndianDate(rawDate: string | null): string {
  if (!rawDate) return ''
  const parsed = new Date(rawDate)
  if (Number.isNaN(parsed.getTime())) return rawDate
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatInr(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return `₹${num.toLocaleString('en-IN')}`
}

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'requested':
      return 'bg-[#B8874B]/15 text-[#8A5F25] border-[#B8874B]/40'
    case 'confirmed':
      return 'bg-[#6B7259]/15 text-[#4A503E] border-[#6B7259]/35'
    case 'preparing':
      return 'bg-[#B8874B]/15 text-[#7A5424] border-[#B8874B]/35'
    case 'out_for_delivery':
      return 'bg-[#2B2420]/10 text-[#2B2420] border-[#2B2420]/30'
    case 'delivered':
      return 'bg-[#6B7259]/20 text-[#3F4534] border-[#6B7259]/45'
    case 'issue':
      return 'bg-red-50 text-red-800 border-red-200'
    case 'cancelled':
      return 'bg-[#E4DDD1]/60 text-[#6B6B60] border-[#D2C9BA]'
    case 'pickup':
    default:
      return 'bg-[#FAF7F2] text-[#5E554E] border-[#D8CFC0]'
  }
}

export default function MyOrdersPage() {
  const { t } = useTranslation()
  const { session, user, loading: authLoading, signInWithGoogle } = useAuth()
  const isCustomerSignInEnabled = import.meta.env.VITE_CUSTOMER_SIGNIN === 'true'

  const [orders, setOrders] = useState<MyOrderRow[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true)
    setOrdersError(null)
    try {
      const { data, error } = await supabase.rpc('get_my_orders')
      if (error) {
        setOrdersError(error.message || t('myOrders.errorGeneric'))
        setOrders([])
        return
      }
      setOrders(Array.isArray(data) ? (data as MyOrderRow[]) : [])
    } catch {
      setOrdersError(t('myOrders.errorGeneric'))
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!isCustomerSignInEnabled || authLoading || !session || !user) {
      return
    }
    void fetchOrders()
  }, [isCustomerSignInEnabled, authLoading, session, user, fetchOrders])

  if (!isCustomerSignInEnabled) {
    return <Navigate to="/" replace />
  }

  async function handleGoogleSignIn() {
    setSigningIn(true)
    setSignInError(null)
    const { error } = await signInWithGoogle()
    if (error) {
      setSignInError(t('account.signInFailed'))
      setSigningIn(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2B2420] overflow-x-hidden">
      <header className="border-b border-[#E4DDD1] bg-[#FAF7F2] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-2 sm:gap-4">
          <Link
            to="/"
            className="font-fraunces text-xl sm:text-2xl font-semibold tracking-tight text-[#2B2420] shrink-0"
          >
            ATELIER
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <CustomerAccountControl />
            <LanguageToggle />
            <Link
              to="/#collection"
              className="hidden sm:inline-flex text-xs font-inter font-semibold uppercase tracking-widest text-[#6B7259] hover:text-[#B8874B] transition-colors whitespace-nowrap"
            >
              {t('myOrders.collection')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 border-b border-[#E4DDD1] pb-5">
          <h1 className="font-fraunces text-2xl sm:text-3xl font-semibold text-[#2B2420]">
            {t('myOrders.title')}
          </h1>
          <p className="mt-1.5 text-sm font-inter text-[#6B6B60]">
            {t('myOrders.subtitle')}
          </p>
        </div>

        {authLoading ? (
          <div className="bg-white/70 border border-[#E4DDD1] p-8 sm:p-10 text-center">
            <div className="inline-block w-6 h-6 border-2 border-[#B8874B] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-inter text-[#6B6B60]">{t('myOrders.loading')}</p>
          </div>
        ) : !session || !user ? (
          <section className="bg-white border border-[#E4DDD1] p-6 sm:p-10 max-w-lg mx-auto text-center">
            <h2 className="font-fraunces text-xl sm:text-2xl font-semibold text-[#2B2420]">
              {t('myOrders.signInTitle')}
            </h2>
            <p className="mt-2 text-sm font-inter text-[#6B6B60] leading-relaxed">
              {t('myOrders.signInDescription')}
            </p>
            {signInError && (
              <p className="mt-3 text-xs font-inter text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                {signInError}
              </p>
            )}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="mt-6 inline-flex items-center justify-center gap-2.5 bg-[#2B2420] text-[#FAF7F2] hover:bg-[#B8874B] transition-colors px-5 py-3 text-xs font-inter font-semibold uppercase tracking-widest disabled:opacity-60 cursor-pointer min-h-[44px]"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>{signingIn ? t('account.connecting') : t('account.signInWithGoogle')}</span>
            </button>
          </section>
        ) : ordersLoading ? (
          <div className="bg-white/70 border border-[#E4DDD1] p-8 sm:p-10 text-center">
            <div className="inline-block w-6 h-6 border-2 border-[#B8874B] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-inter text-[#6B6B60]">{t('myOrders.loading')}</p>
          </div>
        ) : ordersError ? (
          <section className="bg-white border border-[#E4DDD1] p-6 sm:p-8 text-center max-w-lg mx-auto">
            <h2 className="font-fraunces text-lg font-semibold text-[#2B2420]">
              {t('myOrders.errorTitle')}
            </h2>
            <p className="mt-2 text-sm font-inter text-[#6B6B60] break-words">
              {ordersError}
            </p>
            <button
              type="button"
              onClick={() => void fetchOrders()}
              className="mt-5 inline-flex items-center justify-center border border-[#2B2420] text-[#2B2420] hover:bg-[#2B2420] hover:text-[#FAF7F2] transition-colors px-5 py-2.5 text-xs font-inter font-semibold uppercase tracking-widest cursor-pointer min-h-[44px]"
            >
              {t('myOrders.retry')}
            </button>
          </section>
        ) : orders.length === 0 ? (
          <section className="bg-white border border-[#E4DDD1] p-8 sm:p-10 text-center max-w-lg mx-auto">
            <h2 className="font-fraunces text-xl font-semibold text-[#2B2420]">
              {t('myOrders.emptyTitle')}
            </h2>
            <p className="mt-2 text-sm font-inter text-[#6B6B60] leading-relaxed">
              {t('myOrders.emptyDescription')}
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center justify-center bg-[#2B2420] text-[#FAF7F2] hover:bg-[#B8874B] transition-colors px-5 py-3 text-xs font-inter font-semibold uppercase tracking-widest min-h-[44px]"
            >
              {t('myOrders.browseCollection')}
            </Link>
          </section>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const rawStatus = order.delivery_status?.trim() || ''
              const normalizedStatus = rawStatus ? rawStatus.toLowerCase() : 'pickup'
              const statusLabel = t(`myOrders.status.${normalizedStatus}`, {
                defaultValue: rawStatus || 'Pickup',
              })
              const displayDate = formatIndianDate(order.order_date || order.created_at)
              const trackingToken = order.tracking_token?.trim() || ''
              const hasDeliveryFee =
                order.delivery_fee !== null &&
                order.delivery_fee !== undefined &&
                order.delivery_fee !== ''

              return (
                <article
                  key={order.order_id}
                  className="bg-white border border-[#E4DDD1] p-4 sm:p-6 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 bg-[#FAF7F2] border border-[#E4DDD1] overflow-hidden flex items-center justify-center">
                      {order.product_image_url ? (
                        <img
                          src={order.product_image_url}
                          alt={order.product_name || 'ATELIER'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg
                          className="w-7 h-7 text-[#B8874B]/50"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                          />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#2B2420] break-words">
                            {order.product_name || 'ATELIER'}
                          </h2>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-inter text-[#6B6B60]">
                            {order.quantity !== null && order.quantity !== undefined && (
                              <span>
                                {t('myOrders.quantityLabel')}: {order.quantity}
                              </span>
                            )}
                            {displayDate && (
                              <span>
                                {t('myOrders.orderedOn')} {displayDate}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:items-end gap-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-[11px] font-inter font-semibold uppercase tracking-wider border ${getStatusBadgeClasses(
                              normalizedStatus
                            )}`}
                          >
                            {statusLabel}
                          </span>
                          {normalizedStatus === 'requested' && (
                            <p className="text-xs font-inter text-[#8A5F25]">
                              {t('myOrders.requestedNote')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#E4DDD1]/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-inter">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-[#6B6B60]">
                            {t('myOrders.totalLabel')}
                          </p>
                          <p className="mt-0.5 font-semibold text-[#2B2420]">
                            {formatInr(order.total)}
                          </p>
                          {hasDeliveryFee && (
                            <p className="mt-0.5 text-xs text-[#6B6B60]">
                              {t('myOrders.deliveryFeeLabel')}: {formatInr(order.delivery_fee)}
                            </p>
                          )}
                        </div>

                        {(order.delivery_address || order.zone_name) && (
                          <div className="min-w-0">
                            {order.delivery_address && (
                              <>
                                <p className="text-xs uppercase tracking-wider text-[#6B6B60]">
                                  {t('myOrders.deliveryAddressLabel')}
                                </p>
                                <p className="mt-0.5 text-xs sm:text-sm text-[#2B2420] break-words leading-relaxed">
                                  {order.delivery_address}
                                </p>
                              </>
                            )}
                            {order.zone_name && (
                              <p className="mt-1 text-xs text-[#6B7259] font-medium">
                                {t('myOrders.zoneLabel')}: {order.zone_name}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {trackingToken && (
                        <div className="mt-4 pt-3 border-t border-[#E4DDD1]/80 flex justify-end">
                          <Link
                            to={`/track/${encodeURIComponent(trackingToken)}`}
                            className="inline-flex items-center justify-center border border-[#B8874B] text-[#8A5F25] hover:bg-[#B8874B] hover:text-white transition-colors px-4 py-2 text-xs font-inter font-semibold uppercase tracking-widest min-h-[40px]"
                          >
                            {t('myOrders.trackOrder')}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-[#E4DDD1] bg-[#FAF7F2] py-8 px-4 sm:px-8 mt-16 text-[13px] text-[#6B6B60] w-full">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex flex-col items-center sm:items-start">
            <span className="font-fraunces text-base font-semibold text-[#2B2420]">ATELIER</span>
            <span className="text-[10px] font-semibold tracking-[0.2em] text-[#8A5F25] uppercase">
              Fine Furniture
            </span>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2">
            <Link to="/" className="hover:text-[#8A5F25] transition-colors min-h-[44px] inline-flex items-center">
              Storefront
            </Link>
            <span aria-hidden="true" className="text-[#E7E0D4]">·</span>
            <Link
              to="/privacy"
              className="hover:text-[#8A5F25] transition-colors min-h-[44px] inline-flex items-center"
            >
              Privacy Policy
            </Link>
          </div>
          <p className="text-xs uppercase tracking-wider text-[#6B6B60]">
            © {new Date().getFullYear()} ATELIER. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

