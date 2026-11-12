import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

export interface OrderModalProduct {
  id: string
  name: string
  price: number
  image_url: string | null
  stock_qty: number
}

export interface OrderModalLocation {
  latitude: number | null
  longitude: number | null
  pincode: string
  resolvedAddress?: string
  selectedAddressId?: string | null
}

interface SavedCustomerAddress {
  id: string
  user_id: string
  label: string | null
  recipient_name: string
  phone: string
  house_no: string
  street_area: string
  landmark: string | null
  city: string
  state: string
  pincode: string
  latitude: number | null
  longitude: number | null
  is_default: boolean
  created_at?: string
}

type CreateOrderFailureCode =
  | 'not_signed_in'
  | 'invalid_quantity'
  | 'delivery_off'
  | 'product_unavailable'
  | 'out_of_stock'
  | 'not_enough_stock'
  | 'address_not_found'
  | 'invalid_phone'
  | 'not_deliverable'
  | 'too_many_requests'
  | 'phone_in_use'

interface CreateOrderResponse {
  ok: boolean
  code?: CreateOrderFailureCode | string
  message?: string
  duplicate?: boolean
  order_id?: string
  tracking_token?: string | null
  total?: number | string | null
  delivery_fee?: number | string | null
  zone_name?: string | null
}

interface FieldErrors {
  recipientName?: string
  phone?: string
  houseNo?: string
  streetArea?: string
  pincode?: string
}

interface OrderRequestModalProps {
  product: OrderModalProduct
  user: User
  initialLocation?: OrderModalLocation | null
  onClose: () => void
  onEnquireWhatsApp: () => void
}

const KNOWN_ERROR_CODES = new Set<string>([
  'not_signed_in',
  'invalid_quantity',
  'delivery_off',
  'product_unavailable',
  'out_of_stock',
  'not_enough_stock',
  'address_not_found',
  'invalid_phone',
  'not_deliverable',
  'too_many_requests',
  'phone_in_use',
])

const WHATSAPP_FALLBACK_CODES = new Set<string>([
  'not_deliverable',
  'phone_in_use',
  'delivery_off',
])

function formatInr(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return `₹${Math.round(num).toLocaleString('en-IN')}`
}

function normalizeIndianPhone(raw: string): string {
  let cleaned = raw.replace(/[\s\-()]/g, '')
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3)
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.slice(2)
  }
  return cleaned
}

export default function OrderRequestModal({
  product,
  user,
  initialLocation,
  onClose,
  onEnquireWhatsApp,
}: OrderRequestModalProps) {
  const { t } = useTranslation()

  const maxQuantity = Math.max(1, Math.min(product.stock_qty || 1, 10))
  const [quantity, setQuantity] = useState(1)

  const [addresses, setAddresses] = useState<SavedCustomerAddress[]>([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [addressesLoadError, setAddressesLoadError] = useState<string | null>(null)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [useNewAddress, setUseNewAddress] = useState(false)

  const defaultName =
    ((user.user_metadata?.full_name || user.user_metadata?.name || '') as string).trim()
  const initialPin =
    initialLocation?.pincode && /^\d{6}$/.test(initialLocation.pincode.trim())
      ? initialLocation.pincode.trim()
      : ''

  const [addressLabel, setAddressLabel] = useState<'Home' | 'Work' | 'Other'>('Home')
  const [recipientName, setRecipientName] = useState(defaultName)
  const [phone, setPhone] = useState('')
  const [houseNo, setHouseNo] = useState('')
  const [streetArea, setStreetArea] = useState('')
  const [landmark, setLandmark] = useState('')
  const [pincode, setPincode] = useState(initialPin)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const [submitting, setSubmitting] = useState(false)
  const submitLockRef = useRef(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitErrorCode, setSubmitErrorCode] = useState<string | null>(null)
  const [orderSuccess, setOrderSuccess] = useState<CreateOrderResponse | null>(null)

  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const editLockRef = useRef(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Lock page scroll while open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  // Escape closes dialog when not submitting
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting && !savingEdit) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [submitting, savingEdit, onClose])

  // Load saved addresses
  useEffect(() => {
    let cancelled = false

    async function loadAddresses() {
      setAddressesLoading(true)
      setAddressesLoadError(null)
      try {
        const { data, error } = await supabase
          .from('customer_addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false })

        if (cancelled) return

        if (error) {
          setAddresses([])
          setSelectedAddressId(null)
          setUseNewAddress(true)
          setAddressesLoadError(t('orderModal.loadAddressesFailed'))
          return
        }

        const list = (data as SavedCustomerAddress[]) || []
        setAddresses(list)
        if (list.length > 0) {
          const defaultAddr = list.find((addr) => addr.is_default) || list[0]
          setSelectedAddressId(defaultAddr.id)
          setUseNewAddress(false)
        } else {
          setSelectedAddressId(null)
          setUseNewAddress(true)
        }
      } catch {
        if (!cancelled) {
          setAddresses([])
          setSelectedAddressId(null)
          setUseNewAddress(true)
          setAddressesLoadError(t('orderModal.loadAddressesFailed'))
        }
      } finally {
        if (!cancelled) {
          setAddressesLoading(false)
        }
      }
    }

    void loadAddresses()
    return () => {
      cancelled = true
    }
  }, [user.id, t])

  const fillFormFromAddress = (addr: SavedCustomerAddress) => {
    const lbl = addr.label === 'Work' || addr.label === 'Other' ? addr.label : 'Home'
    setAddressLabel(lbl)
    setRecipientName(addr.recipient_name || '')
    setPhone(addr.phone || '')
    setHouseNo(addr.house_no || '')
    setStreetArea(addr.street_area || '')
    setLandmark(addr.landmark || '')
    setPincode(addr.pincode || '')
  }

  const resetNewAddressForm = () => {
    setAddressLabel('Home')
    setRecipientName(defaultName)
    setPhone('')
    setHouseNo('')
    setStreetArea('')
    setLandmark('')
    setPincode(initialPin)
  }

  const handleSelectSavedAddress = (addressId: string) => {
    if (savingEdit) return
    setSelectedAddressId(addressId)
    setUseNewAddress(false)
    setEditingAddressId(null)
    setEditError(null)
    setFieldErrors({})
    setSubmitError(null)
    setSubmitErrorCode(null)
  }

  const handleOpenNewAddressForm = () => {
    if (savingEdit) return
    if (editingAddressId) {
      setEditingAddressId(null)
      setEditError(null)
      resetNewAddressForm()
    }
    setUseNewAddress(true)
    setSelectedAddressId(null)
    setFieldErrors({})
    setSubmitError(null)
    setSubmitErrorCode(null)
  }

  const handleStartEdit = (addr: SavedCustomerAddress) => {
    if (submitting || savingEdit) return
    fillFormFromAddress(addr)
    setEditingAddressId(addr.id)
    setEditError(null)
    setFieldErrors({})
    setSubmitError(null)
    setSubmitErrorCode(null)
  }

  const handleCancelEdit = () => {
    if (savingEdit) return
    const saved = addresses.find((a) => a.id === editingAddressId)
    if (saved) {
      fillFormFromAddress(saved)
    }
    setEditingAddressId(null)
    setEditError(null)
    setFieldErrors({})
  }

  const handleSaveEdit = async () => {
    if (!editingAddressId || editLockRef.current || savingEdit) return
    const validated = validateNewAddressForm()
    if (!validated) return

    editLockRef.current = true
    setSavingEdit(true)
    setEditError(null)

    try {
      const {
        trimmedName,
        cleanedPhone,
        trimmedHouse,
        trimmedStreet,
        trimmedLandmark,
        trimmedPincode,
      } = validated

      const existingAddr = addresses.find((a) => a.id === editingAddressId)
      const existingPincode = existingAddr?.pincode?.trim() || ''

      let latToSave: number | null
      let lngToSave: number | null
      if (trimmedPincode === existingPincode) {
        latToSave = existingAddr?.latitude ?? null
        lngToSave = existingAddr?.longitude ?? null
      } else {
        const initialLocationPin = initialLocation?.pincode?.trim() || ''
        const coordsMatchPincode =
          Boolean(initialLocationPin) &&
          initialLocationPin === trimmedPincode &&
          initialLocation?.latitude != null &&
          initialLocation?.longitude != null
        latToSave = coordsMatchPincode ? initialLocation!.latitude : null
        lngToSave = coordsMatchPincode ? initialLocation!.longitude : null
      }

      const { data: updatedAddr, error: updateErr } = await supabase
        .from('customer_addresses')
        .update({
          label: addressLabel,
          recipient_name: trimmedName,
          phone: cleanedPhone,
          house_no: trimmedHouse,
          street_area: trimmedStreet,
          landmark: trimmedLandmark || null,
          pincode: trimmedPincode,
          latitude: latToSave,
          longitude: lngToSave,
        })
        .eq('id', editingAddressId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateErr || !updatedAddr) {
        setEditError(t('orderModal.validation.updateAddressFailed'))
        return
      }

      const saved = updatedAddr as SavedCustomerAddress
      setAddresses((prev) => prev.map((a) => (a.id === saved.id ? saved : a)))
      setSelectedAddressId(saved.id)
      setEditingAddressId(null)
      setEditError(null)
      setFieldErrors({})
    } catch {
      setEditError(t('orderModal.validation.updateAddressFailed'))
    } finally {
      editLockRef.current = false
      setSavingEdit(false)
    }
  }

  const validateNewAddressForm = () => {
    const errors: FieldErrors = {}
    const trimmedName = recipientName.trim()
    const cleanedPhone = normalizeIndianPhone(phone)
    const trimmedHouse = houseNo.trim()
    const trimmedStreet = streetArea.trim()
    const trimmedLandmark = landmark.trim()
    const trimmedPincode = pincode.trim()

    if (!trimmedName) {
      errors.recipientName = t('orderModal.validation.nameRequired')
    }
    if (!/^[6-9]\d{9}$/.test(cleanedPhone)) {
      errors.phone = t('orderModal.validation.phoneInvalid')
    }
    if (trimmedHouse.length < 4) {
      errors.houseNo = t('orderModal.validation.houseMinLength')
    }
    if (trimmedStreet.length < 4) {
      errors.streetArea = t('orderModal.validation.streetMinLength')
    }
    if (!/^\d{6}$/.test(trimmedPincode)) {
      errors.pincode = t('orderModal.validation.pincodeInvalid')
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      return null
    }

    return {
      trimmedName,
      cleanedPhone,
      trimmedHouse,
      trimmedStreet,
      trimmedLandmark,
      trimmedPincode,
    }
  }

  const ensureAddressId = async (): Promise<string | null> => {
    if (!useNewAddress && selectedAddressId) {
      return selectedAddressId
    }

    const validated = validateNewAddressForm()
    if (!validated) {
      return null
    }

    const {
      trimmedName,
      cleanedPhone,
      trimmedHouse,
      trimmedStreet,
      trimmedLandmark,
      trimmedPincode,
    } = validated

    // Check existing addresses for duplicate or 10-address limit
    const { data: existingData, error: fetchErr } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (fetchErr) {
      setSubmitError(t('orderModal.validation.saveAddressFailed'))
      return null
    }

    const existingList = (existingData as SavedCustomerAddress[]) || []
    const duplicateAddr = existingList.find(
      (addr) =>
        addr.house_no?.trim().toLowerCase() === trimmedHouse.toLowerCase() &&
        addr.street_area?.trim().toLowerCase() === trimmedStreet.toLowerCase() &&
        addr.pincode?.trim() === trimmedPincode
    )

    if (duplicateAddr) {
      setAddresses(existingList)
      return duplicateAddr.id
    }

    if (existingList.length >= 10) {
      setAddresses(existingList)
      setSubmitError(t('orderModal.validation.maxAddressesReached'))
      return null
    }

    const initialLocationPin = initialLocation?.pincode?.trim() || ''
    const coordsMatchPincode =
      Boolean(initialLocationPin) &&
      initialLocationPin === trimmedPincode &&
      initialLocation?.latitude != null &&
      initialLocation?.longitude != null

    const latToSave = coordsMatchPincode ? initialLocation!.latitude : null
    const lngToSave = coordsMatchPincode ? initialLocation!.longitude : null
    const isDefault = existingList.length === 0

    const { data: insertedAddr, error: insertErr } = await supabase
      .from('customer_addresses')
      .insert({
        user_id: user.id,
        label: addressLabel,
        recipient_name: trimmedName,
        phone: cleanedPhone,
        house_no: trimmedHouse,
        street_area: trimmedStreet,
        landmark: trimmedLandmark || null,
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: trimmedPincode,
        latitude: latToSave,
        longitude: lngToSave,
        is_default: isDefault,
      })
      .select()
      .single()

    if (insertErr || !insertedAddr) {
      setSubmitError(t('orderModal.validation.saveAddressFailed'))
      return null
    }

    const newAddr = insertedAddr as SavedCustomerAddress
    setAddresses((prev) => [newAddr, ...prev.filter((a) => a.id !== newAddr.id)])
    return newAddr.id
  }

  const isEditingAddress =
    Boolean(editingAddressId) && !useNewAddress && addresses.length > 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitLockRef.current || submitting || addressesLoading || isEditingAddress || savingEdit) return

    submitLockRef.current = true
    setSubmitting(true)
    setSubmitError(null)
    setSubmitErrorCode(null)

    try {
      const addressId = await ensureAddressId()
      if (!addressId) {
        if (!useNewAddress && !selectedAddressId) {
          setSubmitError(t('orderModal.validation.addressRequired'))
        }
        return
      }

      const { data, error } = await supabase.rpc('create_customer_order', {
        p_product_id: product.id,
        p_quantity: quantity,
        p_address_id: addressId,
      })

      if (error) {
        setSubmitError(t('orderModal.errors.generic'))
        return
      }

      const response = (data || null) as CreateOrderResponse | null
      if (!response || response.ok !== true) {
        const code = response?.code || ''
        setSubmitErrorCode(code || null)
        if (code && KNOWN_ERROR_CODES.has(code)) {
          setSubmitError(t(`orderModal.errors.${code}`))
        } else {
          setSubmitError(t('orderModal.errors.generic'))
        }
        return
      }

      setOrderSuccess(response)
    } catch {
      setSubmitError(t('orderModal.errors.generic'))
    } finally {
      submitLockRef.current = false
      setSubmitting(false)
    }
  }

  const itemSubtotal = product.price * quantity
  const showWhatsAppButton = Boolean(submitErrorCode && WHATSAPP_FALLBACK_CODES.has(submitErrorCode))
  const trackingToken = orderSuccess?.tracking_token?.trim() || ''

  const renderAddressFields = (idPrefix: string, fieldsDisabled: boolean) => (
    <>
      {/* Label pills */}
      <div>
        <label className="block text-xs font-inter font-medium text-[#4A3728] mb-1.5">
          {t('orderModal.labelField')}
        </label>
        <div className="flex flex-wrap gap-2">
          {(['Home', 'Work', 'Other'] as const).map((lbl) => (
            <button
              key={lbl}
              type="button"
              onClick={() => setAddressLabel(lbl)}
              disabled={fieldsDisabled}
              className={`px-3 py-1.5 text-xs font-inter font-medium border transition-colors cursor-pointer min-h-[36px] ${
                addressLabel === lbl
                  ? 'border-[#4A3728] bg-[#4A3728] text-[#FAF7F2]'
                  : 'border-[#E4DDD1] bg-[#FAF7F2] text-[#4A3728] hover:border-[#B8874B]'
              }`}
            >
              {t(`orderModal.labels.${lbl}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Recipient Name */}
      <div>
        <label
          htmlFor={`${idPrefix}-recipient-name`}
          className="block text-xs font-inter font-medium text-[#4A3728] mb-1"
        >
          {t('orderModal.recipientNameLabel')} *
        </label>
        <input
          id={`${idPrefix}-recipient-name`}
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder={t('orderModal.recipientNamePlaceholder')}
          disabled={fieldsDisabled}
          className="w-full px-3 py-2.5 text-sm font-inter bg-[#FAF7F2] border border-[#E4DDD1] text-[#2B2420] focus:outline-none focus:border-[#B8874B]"
        />
        {fieldErrors.recipientName && (
          <p className="mt-1 text-xs font-inter text-red-700">
            {fieldErrors.recipientName}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label
          htmlFor={`${idPrefix}-phone`}
          className="block text-xs font-inter font-medium text-[#4A3728] mb-1"
        >
          {t('orderModal.phoneLabel')} *
        </label>
        <input
          id={`${idPrefix}-phone`}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('orderModal.phonePlaceholder')}
          disabled={fieldsDisabled}
          className="w-full px-3 py-2.5 text-sm font-inter bg-[#FAF7F2] border border-[#E4DDD1] text-[#2B2420] focus:outline-none focus:border-[#B8874B]"
        />
        {fieldErrors.phone && (
          <p className="mt-1 text-xs font-inter text-red-700">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      {/* House / Flat */}
      <div>
        <label
          htmlFor={`${idPrefix}-house-no`}
          className="block text-xs font-inter font-medium text-[#4A3728] mb-1"
        >
          {t('orderModal.houseNoLabel')} *
        </label>
        <input
          id={`${idPrefix}-house-no`}
          type="text"
          value={houseNo}
          onChange={(e) => setHouseNo(e.target.value)}
          placeholder={t('orderModal.houseNoPlaceholder')}
          disabled={fieldsDisabled}
          className="w-full px-3 py-2.5 text-sm font-inter bg-[#FAF7F2] border border-[#E4DDD1] text-[#2B2420] focus:outline-none focus:border-[#B8874B]"
        />
        {fieldErrors.houseNo && (
          <p className="mt-1 text-xs font-inter text-red-700">
            {fieldErrors.houseNo}
          </p>
        )}
      </div>

      {/* Street / Area */}
      <div>
        <label
          htmlFor={`${idPrefix}-street-area`}
          className="block text-xs font-inter font-medium text-[#4A3728] mb-1"
        >
          {t('orderModal.streetAreaLabel')} *
        </label>
        <input
          id={`${idPrefix}-street-area`}
          type="text"
          value={streetArea}
          onChange={(e) => setStreetArea(e.target.value)}
          placeholder={t('orderModal.streetAreaPlaceholder')}
          disabled={fieldsDisabled}
          className="w-full px-3 py-2.5 text-sm font-inter bg-[#FAF7F2] border border-[#E4DDD1] text-[#2B2420] focus:outline-none focus:border-[#B8874B]"
        />
        {fieldErrors.streetArea && (
          <p className="mt-1 text-xs font-inter text-red-700">
            {fieldErrors.streetArea}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Landmark */}
        <div>
          <label
            htmlFor={`${idPrefix}-landmark`}
            className="block text-xs font-inter font-medium text-[#4A3728] mb-1"
          >
            {t('orderModal.landmarkLabel')}
          </label>
          <input
            id={`${idPrefix}-landmark`}
            type="text"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder={t('orderModal.landmarkPlaceholder')}
            disabled={fieldsDisabled}
            className="w-full px-3 py-2.5 text-sm font-inter bg-[#FAF7F2] border border-[#E4DDD1] text-[#2B2420] focus:outline-none focus:border-[#B8874B]"
          />
        </div>

        {/* Pincode */}
        <div>
          <label
            htmlFor={`${idPrefix}-pincode`}
            className="block text-xs font-inter font-medium text-[#4A3728] mb-1"
          >
            {t('orderModal.pincodeLabel')} *
          </label>
          <input
            id={`${idPrefix}-pincode`}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('orderModal.pincodePlaceholder')}
            disabled={fieldsDisabled}
            className="w-full px-3 py-2.5 text-sm font-inter bg-[#FAF7F2] border border-[#E4DDD1] text-[#2B2420] focus:outline-none focus:border-[#B8874B]"
          />
          {fieldErrors.pincode && (
            <p className="mt-1 text-xs font-inter text-red-700">
              {fieldErrors.pincode}
            </p>
          )}
        </div>
      </div>
    </>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2B2420]/55 sm:p-4 overflow-x-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
        className="w-full sm:max-w-lg max-h-[92vh] bg-[#FAF7F2] text-[#2B2420] border border-[#E4DDD1] rounded-t-xl sm:rounded-sm shadow-xl flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-[#E4DDD1] bg-white flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 shrink-0 bg-[#FAF7F2] border border-[#E4DDD1] overflow-hidden flex items-center justify-center">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg
                  className="w-5 h-5 text-[#B8874B]/50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4"
                  />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-inter font-semibold uppercase tracking-widest text-[#B8874B]">
                {t('orderModal.eyebrow')}
              </p>
              <h2
                id="order-modal-title"
                className="font-fraunces text-base sm:text-lg font-semibold text-[#2B2420] truncate"
              >
                {product.name}
              </h2>
              <p className="text-xs font-inter font-semibold text-[#4A3728]">
                {formatInr(product.price)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={t('orderModal.close')}
            className="shrink-0 w-9 h-9 inline-flex items-center justify-center text-[#6B6B60] hover:text-[#2B2420] border border-transparent hover:border-[#E4DDD1] transition-colors disabled:opacity-40 cursor-pointer"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-5">
          {orderSuccess ? (
            <div className="space-y-5">
              <div className="bg-white border border-[#6B7259]/35 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 shrink-0 rounded-full bg-[#6B7259]/15 text-[#4A503E] flex items-center justify-center mt-0.5">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-fraunces text-lg font-semibold text-[#2B2420] leading-snug">
                      {t('orderModal.success.title')}
                    </h3>
                    {orderSuccess.duplicate && (
                      <p className="mt-1.5 text-xs font-inter font-medium text-[#8A5F25]">
                        {t('orderModal.success.duplicateNote')}
                      </p>
                    )}
                    <p className="mt-2 text-xs sm:text-sm font-inter text-[#6B6B60] leading-relaxed">
                      {t('orderModal.success.note')}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 pt-4 border-t border-[#E4DDD1] space-y-2 text-sm font-inter">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[#6B6B60]">{t('orderModal.success.totalLabel')}</dt>
                    <dd className="font-semibold text-[#2B2420]">{formatInr(orderSuccess.total)}</dd>
                  </div>
                  {orderSuccess.delivery_fee !== null &&
                    orderSuccess.delivery_fee !== undefined &&
                    orderSuccess.delivery_fee !== '' && (
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[#6B6B60]">
                          {t('orderModal.success.deliveryFeeLabel')}
                        </dt>
                        <dd className="text-[#2B2420]">{formatInr(orderSuccess.delivery_fee)}</dd>
                      </div>
                    )}
                  {orderSuccess.zone_name && (
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[#6B6B60]">{t('orderModal.success.zoneLabel')}</dt>
                      <dd className="text-[#6B7259] font-medium text-right break-words">
                        {orderSuccess.zone_name}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {trackingToken && (
                  <Link
                    to={`/track/${encodeURIComponent(trackingToken)}`}
                    onClick={onClose}
                    className="w-full sm:flex-1 inline-flex items-center justify-center bg-[#4A3728] text-[#FAF7F2] hover:bg-[#B8874B] transition-colors px-4 py-3 text-xs font-inter font-semibold uppercase tracking-widest min-h-[44px]"
                  >
                    {t('orderModal.success.trackMyOrder')}
                  </Link>
                )}
                <Link
                  to="/my-orders"
                  onClick={onClose}
                  className="w-full sm:flex-1 inline-flex items-center justify-center border border-[#4A3728] text-[#4A3728] hover:bg-[#4A3728] hover:text-[#FAF7F2] transition-colors px-4 py-3 text-xs font-inter font-semibold uppercase tracking-widest min-h-[44px]"
                >
                  {t('orderModal.success.viewMyOrders')}
                </Link>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 text-xs font-inter font-semibold uppercase tracking-widest text-[#6B6B60] hover:text-[#2B2420] transition-colors cursor-pointer"
              >
                {t('orderModal.success.done')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Quantity & Item Subtotal */}
              <div className="bg-white border border-[#E4DDD1] p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-inter font-semibold uppercase tracking-wider text-[#6B7259]">
                    {t('orderModal.quantityLabel')}
                  </span>
                  <div className="inline-flex items-center border border-[#E4DDD1] bg-[#FAF7F2]">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={submitting || quantity <= 1}
                      aria-label={t('orderModal.decreaseQuantity')}
                      className="w-10 h-10 inline-flex items-center justify-center text-base font-semibold text-[#2B2420] hover:bg-[#E4DDD1]/50 disabled:opacity-40 cursor-pointer"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-inter text-sm font-semibold text-[#2B2420]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                      disabled={submitting || quantity >= maxQuantity}
                      aria-label={t('orderModal.increaseQuantity')}
                      className="w-10 h-10 inline-flex items-center justify-center text-base font-semibold text-[#2B2420] hover:bg-[#E4DDD1]/50 disabled:opacity-40 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E4DDD1]/80 flex items-baseline justify-between gap-4">
                  <span className="text-sm font-inter text-[#6B6B60]">
                    {t('orderModal.subtotalLabel')}
                  </span>
                  <span className="text-base font-inter font-semibold text-[#2B2420]">
                    {formatInr(itemSubtotal)}
                  </span>
                </div>

                <p className="text-xs font-inter text-[#6B6B60] leading-relaxed">
                  {t('orderModal.feeAndPaymentNote')}
                </p>
              </div>

              {/* Delivery Address Selection or Form */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-inter font-semibold uppercase tracking-wider text-[#6B7259]">
                    {t('orderModal.deliveryAddressTitle')}
                  </h3>
                  {addresses.length > 0 && useNewAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        const fallbackAddr =
                          addresses.find((a) => a.is_default) || addresses[0]
                        handleSelectSavedAddress(fallbackAddr.id)
                      }}
                      className="text-xs font-inter font-medium text-[#B8874B] underline hover:text-[#4A3728] cursor-pointer"
                    >
                      {t('orderModal.useSavedAddress')}
                    </button>
                  )}
                </div>

                {addressesLoadError && (
                  <p className="text-xs font-inter text-[#8A5F25] bg-[#B8874B]/10 border border-[#B8874B]/30 px-3 py-2">
                    {addressesLoadError}
                  </p>
                )}

                {addressesLoading ? (
                  <div className="bg-white border border-[#E4DDD1] p-4 flex items-center gap-3 text-xs font-inter text-[#6B6B60]">
                    <span className="inline-block w-4 h-4 border-2 border-[#B8874B] border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>{t('orderModal.loadingAddresses')}</span>
                  </div>
                ) : (
                  <>
                    {addresses.length > 0 && (
                      <div className="space-y-2.5">
                        {addresses.map((addr) => {
                          const isSelected = !useNewAddress && selectedAddressId === addr.id
                          const isBeingEdited = isSelected && editingAddressId === addr.id
                          return (
                            <div key={addr.id} className="space-y-2">
                              <div
                                role="button"
                                tabIndex={submitting || savingEdit ? -1 : 0}
                                onClick={() => {
                                  if (!submitting && !savingEdit) {
                                    handleSelectSavedAddress(addr.id)
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (
                                    (e.key === 'Enter' || e.key === ' ') &&
                                    !submitting &&
                                    !savingEdit
                                  ) {
                                    e.preventDefault()
                                    handleSelectSavedAddress(addr.id)
                                  }
                                }}
                                aria-pressed={isSelected}
                                className={`w-full text-left p-3.5 border transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'border-[#B8874B] bg-white ring-1 ring-[#B8874B]'
                                    : 'border-[#E4DDD1] bg-white/80 hover:border-[#B8874B]/60'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[10px] font-inter font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-[#FAF7F2] border border-[#E4DDD1] text-[#4A3728]">
                                      {addr.label || 'Home'}
                                    </span>
                                    {addr.is_default && (
                                      <span className="text-[10px] font-inter font-medium text-[#6B7259]">
                                        {t('orderModal.defaultBadge')}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2.5 shrink-0">
                                    {isSelected && !isBeingEdited && (
                                      <button
                                        type="button"
                                        disabled={submitting || savingEdit}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleStartEdit(addr)
                                        }}
                                        className="text-xs font-inter font-medium text-[#B8874B] underline hover:text-[#4A3728] cursor-pointer disabled:opacity-50"
                                      >
                                        {t('orderModal.editAddress')}
                                      </button>
                                    )}
                                    <span
                                      className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                                        isSelected
                                          ? 'border-[#B8874B] bg-[#B8874B]'
                                          : 'border-[#D2C9BA] bg-white'
                                      }`}
                                      aria-hidden="true"
                                    >
                                      {isSelected && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                      )}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-sm font-inter font-semibold text-[#2B2420] break-words">
                                  {addr.recipient_name}
                                </p>
                                <p className="text-xs font-inter text-[#4A3728] break-words mt-0.5">
                                  {addr.house_no}, {addr.street_area}
                                </p>
                                <p className="text-xs font-inter text-[#6B7259] mt-0.5">
                                  {addr.pincode}
                                </p>
                              </div>

                              {isBeingEdited && (
                                <div className="bg-white border border-[#B8874B] p-4 space-y-3.5">
                                  <p className="text-xs font-inter font-semibold uppercase tracking-wider text-[#6B7259]">
                                    {t('orderModal.editAddressTitle')}
                                  </p>
                                  {renderAddressFields('edit', submitting || savingEdit)}
                                  {editError && (
                                    <p className="text-xs font-inter text-red-800 bg-red-50 border border-red-200 px-3 py-2 break-words">
                                      {editError}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-end gap-2.5 pt-1">
                                    <button
                                      type="button"
                                      disabled={savingEdit}
                                      onClick={handleCancelEdit}
                                      className="px-4 py-2 text-xs font-inter font-semibold uppercase tracking-wider border border-[#E4DDD1] bg-[#FAF7F2] text-[#4A3728] hover:border-[#B8874B] disabled:opacity-50 cursor-pointer min-h-[38px]"
                                    >
                                      {t('orderModal.cancelEdit')}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingEdit}
                                      onClick={handleSaveEdit}
                                      className="px-4 py-2 text-xs font-inter font-semibold uppercase tracking-wider bg-[#4A3728] text-[#FAF7F2] hover:bg-[#B8874B] disabled:opacity-50 cursor-pointer min-h-[38px]"
                                    >
                                      {savingEdit ? t('orderModal.savingAddress') : t('orderModal.saveAddress')}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        <button
                          type="button"
                          onClick={handleOpenNewAddressForm}
                          disabled={submitting}
                          className={`w-full text-left p-3 border border-dashed transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                            useNewAddress
                              ? 'border-[#B8874B] bg-white ring-1 ring-[#B8874B] text-[#2B2420]'
                              : 'border-[#D2C9BA] bg-white/60 text-[#4A3728] hover:border-[#B8874B]'
                          }`}
                        >
                          <span className="text-xs font-inter font-semibold">
                            + {t('orderModal.useDifferentAddress')}
                          </span>
                        </button>
                      </div>
                    )}

                    {(useNewAddress || addresses.length === 0) && (
                      <div className="bg-white border border-[#E4DDD1] p-4 space-y-3.5">
                        {renderAddressFields('order', submitting)}
                      </div>
                    )}
                  </>
                )}
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 px-3.5 py-3 space-y-2.5">
                  <p className="text-xs sm:text-sm font-inter text-red-800 break-words">
                    {submitError}
                  </p>
                  {showWhatsAppButton && (
                    <button
                      type="button"
                      onClick={onEnquireWhatsApp}
                      className="inline-flex items-center justify-center border border-[#4A3728] bg-white text-[#4A3728] hover:bg-[#4A3728] hover:text-[#FAF7F2] transition-colors px-3.5 py-2 text-xs font-inter font-semibold uppercase tracking-wider cursor-pointer min-h-[38px]"
                    >
                      {t('orderModal.whatsappFallback')}
                    </button>
                  )}
                </div>
              )}

              {isEditingAddress && (
                <p className="text-xs font-inter text-[#6B6B60] text-center">
                  {t('orderModal.finishEditingFirst')}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || addressesLoading || isEditingAddress || savingEdit}
                className="w-full inline-flex items-center justify-center bg-[#4A3728] text-[#FAF7F2] hover:bg-[#B8874B] transition-colors px-6 py-3.5 text-xs font-inter font-semibold uppercase tracking-widest disabled:opacity-50 cursor-pointer min-h-[46px]"
              >
                {submitting ? t('orderModal.placingOrder') : t('orderModal.placeOrder')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

