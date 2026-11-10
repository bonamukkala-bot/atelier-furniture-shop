import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { CustomerAddress } from '../lib/types'

interface SavedAddressPickerProps {
  userId: string
  selectedId: string | null
  refreshKey: number
  onSelect: (addr: CustomerAddress | null) => void
}

export default function SavedAddressPicker({
  userId,
  selectedId,
  refreshKey,
  onSelect,
}: SavedAddressPickerProps) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAddresses() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('customer_addresses')
          .select('*')
          .eq('user_id', userId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false })

        if (cancelled) return

        if (error) {
          console.warn('Failed to load customer addresses:', error)
          setAddresses([])
          return
        }

        setAddresses((data as CustomerAddress[]) || [])
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to load customer addresses:', err)
          setAddresses([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (userId) {
      fetchAddresses()
    } else {
      setAddresses([])
      setLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  if (loading || addresses.length === 0) {
    return null
  }

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <label className="block font-inter text-[11px] font-semibold uppercase tracking-wider text-[#6B7259]">
          Saved Addresses
        </label>
        {selectedId && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[11px] font-inter text-[#B8874B] hover:text-[#4A3728] font-medium transition-colors cursor-pointer"
          >
            + Use a new address
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {addresses.map((addr) => {
          const isSelected = selectedId === addr.id
          return (
            <button
              key={addr.id}
              type="button"
              onClick={() => onSelect(addr)}
              className={`text-left p-3 border rounded-sm transition-all cursor-pointer relative ${
                isSelected
                  ? 'border-[#B8874B] bg-[#FAF7F2] ring-1 ring-[#B8874B]'
                  : 'border-[#E4DDD1] bg-white hover:border-[#B8874B]/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-[#FAF7F2] border border-[#E4DDD1] text-[#4A3728] rounded-xs">
                    {addr.label || 'Address'}
                  </span>
                  {addr.is_default && (
                    <span className="text-[10px] font-medium text-[#6B7259]">
                      Default
                    </span>
                  )}
                </span>
                {isSelected && (
                  <span className="inline-flex items-center text-xs font-semibold text-[#B8874B]">
                    <svg
                      className="w-3.5 h-3.5 mr-0.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Selected
                  </span>
                )}
              </div>
              <p className="font-inter text-xs font-medium text-[#2B2420] line-clamp-1">
                {addr.house_no}
              </p>
              <p className="font-inter text-[11px] text-[#6B7259] line-clamp-1">
                {addr.street_area}
                {addr.landmark ? `, Near ${addr.landmark}` : ''}
              </p>
              <p className="font-inter text-[11px] text-[#6B7259] mt-0.5">
                {addr.pincode}
              </p>
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`text-left p-3 border rounded-sm transition-all cursor-pointer flex flex-col items-center justify-center min-h-[88px] ${
            selectedId === null
              ? 'border-[#B8874B] bg-[#FAF7F2] ring-1 ring-[#B8874B]'
              : 'border-dashed border-[#E4DDD1] bg-white hover:border-[#B8874B]/60'
          }`}
        >
          <span className="font-inter text-xs font-semibold text-[#4A3728] flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5 text-[#B8874B]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Use a new address
          </span>
          <span className="font-inter text-[11px] text-[#6B7259] mt-0.5">
            Enter a different delivery address
          </span>
        </button>
      </div>
    </div>
  )
}

