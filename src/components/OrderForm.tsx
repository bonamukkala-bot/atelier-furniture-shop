import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Product, DeliveryZone, DeliveryEnquiry } from '../lib/types'

interface OrderFormProps {
  onSuccess: () => void
  onCancel: () => void
  deliveryEnabled?: boolean
}

function OrderForm({ onSuccess, onCancel, deliveryEnabled: propDeliveryEnabled }: OrderFormProps) {
  // ── Standard Order State ──
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [total, setTotal] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Delivery & Fulfillment State ──
  const [isDeliveryEnabled, setIsDeliveryEnabled] = useState(propDeliveryEnabled ?? true)
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup')
  const [doorFlatBuilding, setDoorFlatBuilding] = useState('')
  const [streetLocality, setStreetLocality] = useState('')
  const [deliveryZoneId, setDeliveryZoneId] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([])

  // ── Customer Delivery Enquiry Linking State ──
  const [matchedEnquiry, setMatchedEnquiry] = useState<DeliveryEnquiry | null>(null)
  const [dismissedEnquiryId, setDismissedEnquiryId] = useState<string | null>(null)
  const [linkedEnquiryId, setLinkedEnquiryId] = useState<string | null>(null)
  const [prepDays, setPrepDays] = useState<number>(3)

  // ── Initial Data Load ──
  useEffect(() => {
    async function loadInitialData() {
      const [productsRes, zonesRes, settingsRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('sold', false)
          .gt('stock_qty', 0)
          .order('name', { ascending: true }),
        supabase
          .from('delivery_zones')
          .select('*')
          .order('fee', { ascending: true }),
        supabase.from('shop_settings').select('delivery_enabled, prep_days').eq('id', 1).maybeSingle(),
      ])

      setProducts(productsRes.data ?? [])
      setDeliveryZones(zonesRes.data ?? [])

      if (settingsRes.data) {
        if (settingsRes.data.prep_days !== undefined && settingsRes.data.prep_days !== null) {
          setPrepDays(settingsRes.data.prep_days)
        }
        if (propDeliveryEnabled === undefined && settingsRes.data.delivery_enabled !== undefined && settingsRes.data.delivery_enabled !== null) {
          setIsDeliveryEnabled(settingsRes.data.delivery_enabled)
        }
      }
      if (propDeliveryEnabled !== undefined) {
        setIsDeliveryEnabled(propDeliveryEnabled)
      }
    }
    loadInitialData()
  }, [propDeliveryEnabled])

  const selectedProduct = products.find((p) => p.id === productId) ?? null

  // ── Auto-match unclosed delivery enquiries by phone number ──
  useEffect(() => {
    const trimmed = customerPhone.trim()
    if (trimmed.length < 10) {
      setMatchedEnquiry(null)
      return
    }

    let active = true
    async function checkEnquiry() {
      try {
        const { data, error: fetchErr } = await supabase
          .from('delivery_enquiries')
          .select(`
            *,
            delivery_zones ( id, zone_name, fee, transit_min_days, transit_max_days )
          `)
          .eq('phone', trimmed)
          .neq('status', 'closed')
          .order('created_at', { ascending: false })
          .limit(1)

        if (active && !fetchErr && data && data.length > 0) {
          const enquiry = data[0]
          if (enquiry.id !== dismissedEnquiryId && enquiry.id !== linkedEnquiryId) {
            setMatchedEnquiry(enquiry)
          }
        } else if (active) {
          setMatchedEnquiry(null)
        }
      } catch (err) {
        console.warn('Error checking matching delivery enquiry:', err)
      }
    }

    checkEnquiry()
    return () => {
      active = false
    }
  }, [customerPhone, dismissedEnquiryId, linkedEnquiryId])

  // ── Enquiry Linking Handlers ──
  function handleLinkEnquiry() {
    if (!matchedEnquiry) return

    setLinkedEnquiryId(matchedEnquiry.id)
    setFulfillmentType('delivery')

    if (!customerName.trim() && matchedEnquiry.customer_name) {
      setCustomerName(matchedEnquiry.customer_name)
    }
    if (matchedEnquiry.door_flat_building) {
      setDoorFlatBuilding(matchedEnquiry.door_flat_building)
    }
    if (matchedEnquiry.street_locality) {
      setStreetLocality(matchedEnquiry.street_locality)
    } else if (matchedEnquiry.area_text) {
      setStreetLocality(matchedEnquiry.area_text)
    }

    if (matchedEnquiry.zone_id) {
      setDeliveryZoneId(matchedEnquiry.zone_id)
      const matchingZone = deliveryZones.find((z) => z.id === matchedEnquiry.zone_id)
      if (matchingZone) {
        setDeliveryFee(matchingZone.fee.toString())
      } else if (matchedEnquiry.delivery_zones?.fee) {
        setDeliveryFee(matchedEnquiry.delivery_zones.fee.toString())
      }
    }

    if (!productId && matchedEnquiry.product_id) {
      setProductId(matchedEnquiry.product_id)
    }

    setMatchedEnquiry(null)
  }

  function handleDismissEnquiry() {
    if (matchedEnquiry) {
      setDismissedEnquiryId(matchedEnquiry.id)
      setMatchedEnquiry(null)
    }
  }

  // ── Zone Selection Handler ──
  function handleZoneChange(newZoneId: string) {
    setDeliveryZoneId(newZoneId)
    const selectedZone = deliveryZones.find((z) => z.id === newZoneId)
    if (selectedZone) {
      setDeliveryFee(selectedZone.fee.toString())
    }
  }

  // ── Form Submission ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validate quantity against available stock
    if (selectedProduct && quantity > selectedProduct.stock_qty) {
      setError(
        `Only ${selectedProduct.stock_qty} unit${selectedProduct.stock_qty === 1 ? '' : 's'} available in stock. Please reduce the quantity.`
      )
      return
    }

    // Validate delivery fields if delivery is chosen
    if (fulfillmentType === 'delivery') {
      if (!doorFlatBuilding.trim()) {
        setError('Please enter the Flat / Door / Building address for delivery.')
        return
      }
      if (!streetLocality.trim()) {
        setError('Please enter the Street / Locality for delivery.')
        return
      }
      if (!deliveryZoneId) {
        setError('Please select a delivery zone.')
        return
      }
    }

    setSaving(true)

    try {
      const trimmedPhone = customerPhone.trim()
      let customerId: string

      // Step 1: Check if customer already exists by phone number
      const { data: existingCustomer, error: lookupError } = await supabase
        .from('customers')
        .select('id, name')
        .eq('phone', trimmedPhone)
        .single()

      if (existingCustomer) {
        customerId = existingCustomer.id
        if (existingCustomer.name !== customerName.trim()) {
          await supabase
            .from('customers')
            .update({ name: customerName.trim() })
            .eq('id', customerId)
        }
      } else if (lookupError && lookupError.code !== 'PGRST116') {
        throw lookupError
      } else {
        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert({ name: customerName.trim(), phone: trimmedPhone })
          .select()
          .single()

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: retryCustomer, error: retryError } = await supabase
              .from('customers')
              .select('id')
              .eq('phone', trimmedPhone)
              .single()

            if (retryError) throw retryError
            customerId = retryCustomer.id
          } else {
            throw insertError
          }
        } else {
          customerId = newCustomer.id
        }
      }

      // Step 2: Prepare order payload
      const fullDeliveryAddress =
        fulfillmentType === 'delivery'
          ? [doorFlatBuilding.trim(), streetLocality.trim()].filter(Boolean).join(', ')
          : null

      const parsedDeliveryFee =
        fulfillmentType === 'delivery' && deliveryFee.trim()
          ? parseFloat(deliveryFee)
          : null

      const orderPayload: any = {
        customer_id: customerId,
        product_id: productId,
        quantity: quantity,
        order_date: orderDate,
        total: total ? parseFloat(total) : null,
        review_requested: false,
        fulfillment_type: fulfillmentType,
        delivery_address: fullDeliveryAddress,
        delivery_zone_id: fulfillmentType === 'delivery' ? (deliveryZoneId || null) : null,
        delivery_fee: parsedDeliveryFee,
        delivery_status: fulfillmentType === 'delivery' ? 'confirmed' : null,
      }

      const { data: createdOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single()

      if (orderError) throw orderError

      // Step 3: If fulfillment is delivery, insert one row into delivery_status_history
      if (fulfillmentType === 'delivery' && createdOrder?.id) {
        try {
          await supabase.from('delivery_status_history').insert({
            order_id: createdOrder.id,
            status: 'confirmed',
            note: 'Order created',
          })
        } catch (historyErr) {
          console.warn('Error inserting into delivery_status_history:', historyErr)
        }
      }

      // Step 4: If a delivery enquiry was linked, update its status to 'closed'
      if (linkedEnquiryId) {
        try {
          await supabase
            .from('delivery_enquiries')
            .update({ status: 'closed' })
            .eq('id', linkedEnquiryId)
        } catch (enquiryErr) {
          console.warn('Error closing linked delivery enquiry:', enquiryErr)
        }
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 border border-[#E4DDD1] space-y-6 rounded-none relative max-w-2xl mx-auto">
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#B8874B]" />
      
      <h2 className="font-fraunces text-xl sm:text-2xl font-normal text-[#2B2420]">Record New Order</h2>

      {error && (
        <div className="bg-[#4A3728]/5 border border-[#E4DDD1] text-xs text-[#4A3728] p-3 text-center leading-relaxed">
          {error}
        </div>
      )}

      {/* Product Selection */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Product</label>
        <select
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value)
            setQuantity(1)
          }}
          required
          className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors appearance-none cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234A3728' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
        >
          <option value="" className="text-[#6B7259]/50 bg-white">Select a product...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id} className="bg-white">
              {p.name} — ₹{p.price.toLocaleString('en-IN')} ({p.stock_qty} in stock)
            </option>
          ))}
        </select>
        {products.length === 0 && (
          <p className="text-[10px] text-[#C0523C] mt-1.5">No products currently in stock.</p>
        )}
      </div>

      {/* Quantity */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Quantity</label>
        <input
          type="number"
          value={quantity}
          min={1}
          max={selectedProduct?.stock_qty ?? undefined}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          required
          className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
        />
        {selectedProduct && (
          <p className="text-[10px] text-[#6B7259] mt-1.5">
            Available: {selectedProduct.stock_qty} unit{selectedProduct.stock_qty === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Customer Name</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">WhatsApp Number</label>
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            required
            placeholder="91XXXXXXXXXX"
            pattern="[0-9]{10,15}"
            title="Country code + number, digits only, no spaces or +"
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors placeholder-[#6B7259]/40"
          />
          <p className="text-[10px] text-[#6B7259] mt-1.5 leading-relaxed">
            Digits only, with country code — e.g. 919876543210 (no + or spaces)
          </p>
        </div>
      </div>

      {/* ── Fulfillment Type (Only if delivery is enabled in shop_settings) ── */}
      {isDeliveryEnabled && (
        <div className="pt-1">
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
            Fulfillment Type
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF7F2] border border-[#E4DDD1]">
            <button
              type="button"
              onClick={() => setFulfillmentType('pickup')}
              className={`py-2 px-3 text-xs uppercase tracking-wider font-semibold transition-all ${
                fulfillmentType === 'pickup'
                  ? 'bg-[#4A3728] text-[#FAF7F2] shadow-sm'
                  : 'bg-transparent text-[#6B7259] hover:text-[#2B2420]'
              }`}
            >
              Pickup (Workshop)
            </button>
            <button
              type="button"
              onClick={() => setFulfillmentType('delivery')}
              className={`py-2 px-3 text-xs uppercase tracking-wider font-semibold transition-all ${
                fulfillmentType === 'delivery'
                  ? 'bg-[#4A3728] text-[#FAF7F2] shadow-sm'
                  : 'bg-transparent text-[#6B7259] hover:text-[#2B2420]'
              }`}
            >
              Delivery
            </button>
          </div>
        </div>
      )}

      {/* ── Delivery Details Section (Visible when Delivery is selected) ── */}
      {isDeliveryEnabled && fulfillmentType === 'delivery' && (
        <div className="space-y-4 pt-2 border-t border-[#E4DDD1]/80">
          {/* Matched Enquiry Notification Banner */}
          {matchedEnquiry && (
            <div className="bg-[#B8874B]/10 border border-[#B8874B]/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-[#4A3728] m-0">
                  Found a matching delivery enquiry from {matchedEnquiry.customer_name}
                </p>
                <p className="text-[#6B7259] text-[11px] mt-0.5 mb-0">
                  Link and close it to auto-fill address and zone details.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleLinkEnquiry}
                  className="px-3 py-1.5 bg-[#4A3728] text-[#FAF7F2] font-semibold text-[11px] uppercase tracking-wider hover:bg-[#2B2420] transition-colors cursor-pointer"
                >
                  Yes, Link
                </button>
                <button
                  type="button"
                  onClick={handleDismissEnquiry}
                  className="px-3 py-1.5 bg-transparent border border-[#E4DDD1] text-[#6B7259] font-semibold text-[11px] uppercase tracking-wider hover:bg-white transition-colors cursor-pointer"
                >
                  No
                </button>
              </div>
            </div>
          )}

          {/* Linked Enquiry Status */}
          {linkedEnquiryId && (
            <div className="bg-[#525843]/10 border border-[#525843]/30 px-3 py-2 text-[11px] text-[#525843] flex items-center justify-between">
              <span>✓ Linked to customer delivery enquiry (will be closed on order creation)</span>
              <button
                type="button"
                onClick={() => setLinkedEnquiryId(null)}
                className="text-[#A84B3B] hover:underline uppercase text-[10px] font-semibold tracking-wider cursor-pointer"
              >
                Unlink
              </button>
            </div>
          )}

          {/* Address Fields */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
              Door / Flat / Building Name *
            </label>
            <input
              type="text"
              value={doorFlatBuilding}
              onChange={(e) => setDoorFlatBuilding(e.target.value)}
              required={fulfillmentType === 'delivery'}
              placeholder="e.g. Flat 402, Block B, Rainbow Vistas"
              className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors placeholder-[#6B7259]/40"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
              Street / Locality / Landmark *
            </label>
            <input
              type="text"
              value={streetLocality}
              onChange={(e) => setStreetLocality(e.target.value)}
              required={fulfillmentType === 'delivery'}
              placeholder="e.g. Near Inorbit Mall, Mindspace Road, Madhapur"
              className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors placeholder-[#6B7259]/40"
            />
          </div>

          {/* Zone & Fee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
                Delivery Zone *
              </label>
              <select
                value={deliveryZoneId}
                onChange={(e) => handleZoneChange(e.target.value)}
                required={fulfillmentType === 'delivery'}
                className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234A3728' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '16px',
                }}
              >
                <option value="" className="text-[#6B7259]/50 bg-white">Select delivery zone...</option>
                {deliveryZones.map((z) => (
                  <option key={z.id} value={z.id} className="bg-white">
                    {z.zone_name} (Within {z.max_distance_km}km | {z.transit_min_days ?? 2}–{z.transit_max_days ?? 4}d transit) — ₹{Number(z.fee).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
              {deliveryZoneId && (() => {
                const z = deliveryZones.find((item) => item.id === deliveryZoneId)
                if (!z) return null
                return (
                  <p className="text-[10px] text-[#B8874B] font-medium mt-1.5 leading-relaxed">
                    Estimated delivery: {prepDays + (z.transit_min_days ?? 2)}–{prepDays + (z.transit_max_days ?? 4)} days from order confirmation.
                  </p>
                )
              })()}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
                Delivery Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                placeholder="e.g. 500"
                className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
              />
              <p className="text-[10px] text-[#6B7259] mt-1.5 leading-relaxed">
                Auto-filled from zone; editable for custom/negotiated rates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Date and Total */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Date of Purchase</label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            required
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Total Amount (₹)</label>
          <input
            type="number"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            step="0.01"
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-[#E4DDD1] flex-col sm:flex-row">
        <button
          type="submit"
          disabled={saving}
          className="bg-[#4A3728] hover:bg-[#2B2420] text-[#FAF7F2] px-6 py-3 text-xs uppercase tracking-widest font-semibold rounded-none disabled:opacity-50 transition-colors duration-300 cursor-pointer min-h-[44px]"
        >
          {saving ? 'Saving...' : 'Record Order'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-transparent hover:bg-[#FAF7F2] text-[#6B7259] border border-[#E4DDD1] px-6 py-3 text-xs uppercase tracking-widest font-semibold rounded-none transition-colors duration-300 cursor-pointer min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default OrderForm