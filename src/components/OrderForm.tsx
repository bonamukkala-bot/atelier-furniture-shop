import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Product } from '../lib/types'

interface OrderFormProps {
  onSuccess: () => void
  onCancel: () => void
}

function OrderForm({ onSuccess, onCancel }: OrderFormProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [total, setTotal] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Only show products that are available: not delisted AND has stock
  useEffect(() => {
    async function loadProducts() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('sold', false)
        .gt('stock_qty', 0)
        .order('name', { ascending: true })
      setProducts(data ?? [])
    }
    loadProducts()
  }, [])

  const selectedProduct = products.find((p) => p.id === productId) ?? null

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
        // Customer exists - use their ID, optionally update name if different
        customerId = existingCustomer.id
        if (existingCustomer.name !== customerName.trim()) {
          await supabase
            .from('customers')
            .update({ name: customerName.trim() })
            .eq('id', customerId)
        }
      } else if (lookupError && lookupError.code !== 'PGRST116') {
        // Error other than "not found"
        throw lookupError
      } else {
        // Customer doesn't exist - create new one
        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert({ name: customerName.trim(), phone: trimmedPhone })
          .select()
          .single()

        if (insertError) {
          // Handle unique constraint violation (duplicate phone)
          if (insertError.code === '23505') {
            // Race condition: customer was created by another request
            // Re-run the lookup to get the existing customer
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

      // Step 2: create the order — the DB trigger handles stock reduction automatically
      const { error: orderError } = await supabase.from('orders').insert({
        customer_id: customerId,
        product_id: productId,
        quantity: quantity,
        order_date: orderDate,
        total: total ? parseFloat(total) : null,
        review_requested: false,
      })

      if (orderError) throw orderError

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

      {/* Product */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Product</label>
        <select
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value)
            setQuantity(1) // reset quantity on product change
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