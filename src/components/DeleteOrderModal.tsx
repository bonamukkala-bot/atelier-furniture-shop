import { useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../context/ToastContext'

export interface DeleteOrderSummary {
  id: string
  productName: string
  date: string
  total: number | null | undefined
  statusLabel: string
}

interface DeleteOrderModalProps {
  order: DeleteOrderSummary | null
  onClose: () => void
  onDeleted: () => void | Promise<void>
}

interface AdminDeleteOrderResult {
  ok?: boolean
  code?: string
  message?: string
  stock_returned?: boolean
}

export default function DeleteOrderModal({
  order,
  onClose,
  onDeleted,
}: DeleteOrderModalProps) {
  if (!order) return null

  return (
    <DeleteOrderModalContent
      key={order.id}
      order={order}
      onClose={onClose}
      onDeleted={onDeleted}
    />
  )
}

function DeleteOrderModalContent({
  order,
  onClose,
  onDeleted,
}: {
  order: DeleteOrderSummary
  onClose: () => void
  onDeleted: () => void | Promise<void>
}) {
  const { showToast } = useToast()
  const [confirmText, setConfirmText] = useState('')
  const [returnStock, setReturnStock] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteLockRef = useRef(false)

  const canConfirm = confirmText.trim() === 'DELETE' && !deleting

  async function handleConfirm() {
    if (!canConfirm || deleteLockRef.current) return
    deleteLockRef.current = true
    setDeleting(true)

    try {
      const { data, error } = await supabase.rpc('admin_delete_order', {
        p_order_id: order.id,
        p_return_stock: returnStock,
      })

      if (error) {
        showToast('Could not delete this order. Please try again.', 'error')
        return
      }

      const result = (data ?? null) as AdminDeleteOrderResult | null
      if (result?.ok === true) {
        showToast(
          result.stock_returned
            ? 'Order deleted and stock put back'
            : 'Order deleted',
          'success'
        )
        onClose()
        await onDeleted()
        return
      }

      switch (result?.code) {
        case 'not_admin':
          showToast('You do not have permission to delete orders.', 'error')
          break
        case 'not_found':
          showToast('Order not found. It may already be deleted.', 'error')
          onClose()
          await onDeleted()
          break
        case 'out_for_delivery':
          showToast('Orders that are out for delivery cannot be deleted.', 'error')
          onClose()
          await onDeleted()
          break
        default:
          showToast('Could not delete this order. Please try again.', 'error')
          break
      }
    } catch {
      showToast('Could not delete this order. Please try again.', 'error')
    } finally {
      deleteLockRef.current = false
      setDeleting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(43,36,32,0.55)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={() => {
        if (!deleting) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-order-title"
        className="w-full max-w-md bg-white border border-[#E4DDD1] rounded-sm shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="delete-order-title"
          style={{
            fontFamily: 'Fraunces, serif',
            fontSize: 18,
            fontWeight: 400,
            color: '#2B2420',
            margin: '0 0 12px',
          }}
        >
          Delete order
        </h3>

        <div className="bg-[#FAF7F2] border border-[#E4DDD1] rounded-sm p-3.5 mb-4 space-y-1.5 text-xs">
          <div className="flex justify-between gap-3">
            <span className="text-[#6B7259]">Product</span>
            <span className="text-[#2B2420] font-medium text-right break-words">
              {order.productName}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[#6B7259]">Date</span>
            <span className="text-[#2B2420] font-medium text-right">
              {order.date}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[#6B7259]">Total</span>
            <span className="text-[#2B2420] font-medium text-right">
              {order.total !== null && order.total !== undefined
                ? `₹${Number(order.total).toLocaleString('en-IN')}`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[#6B7259]">Status</span>
            <span className="text-[#2B2420] font-medium text-right">
              {order.statusLabel}
            </span>
          </div>
        </div>

        <label className="flex items-start gap-2.5 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={returnStock}
            disabled={deleting}
            onChange={(e) => setReturnStock(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#4A3728] cursor-pointer disabled:cursor-not-allowed"
          />
          <span>
            <span className="block text-sm font-medium text-[#2B2420]">
              Also put the stock back
            </span>
            <span className="block text-xs text-[#6B7259] mt-0.5">
              Only for orders that took stock. Do not tick this for old orders from before stock tracking.
            </span>
          </span>
        </label>

        <div className="mb-5">
          <label
            htmlFor="delete-order-confirm-input"
            className="block text-xs font-medium text-[#2B2420] mb-1.5"
          >
            Type DELETE to confirm
          </label>
          <input
            id="delete-order-confirm-input"
            type="text"
            value={confirmText}
            disabled={deleting}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="w-full px-3 py-2 text-sm text-[#2B2420] bg-[#FAF7F2] border border-[#E4DDD1] rounded-sm focus:outline-none focus:border-[#B8874B] disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (!deleting) onClose()
            }}
            className="px-4 py-2 text-sm font-medium text-[#2B2420] bg-[#FAF7F2] border border-[#E4DDD1] rounded-sm hover:border-[#B8874B] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-[#991B1B] border border-[#991B1B] rounded-sm hover:bg-[#7F1D1D] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {deleting ? 'Deleting...' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
