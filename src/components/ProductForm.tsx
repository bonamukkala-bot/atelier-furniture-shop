import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Product, NewProduct } from '../lib/types'

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

interface ProductFormProps {
  existingProduct?: Product
  onSuccess: () => void
  onCancel: () => void
}

function ProductForm({ existingProduct, onSuccess, onCancel }: ProductFormProps) {
  const [name, setName] = useState(existingProduct?.name ?? '')
  const [category, setCategory] = useState(existingProduct?.category ?? '')
  const [material, setMaterial] = useState(existingProduct?.material ?? '')
  const [description, setDescription] = useState(existingProduct?.description ?? '')
  const [careInstructions, setCareInstructions] = useState(existingProduct?.care_instructions ?? '')
  const [dimensions, setDimensions] = useState(existingProduct?.dimensions ?? '')
  const initialOriginalPrice = existingProduct?.compare_at_price && existingProduct.compare_at_price > existingProduct.price
    ? existingProduct.compare_at_price.toString()
    : (existingProduct?.price?.toString() ?? '')
  const initialDiscountPercent = existingProduct?.compare_at_price && existingProduct.compare_at_price > existingProduct.price
    ? Math.round(((existingProduct.compare_at_price - existingProduct.price) / existingProduct.compare_at_price) * 100).toString()
    : ''

  const [price, setPrice] = useState(initialOriginalPrice)
  const [discountPercent, setDiscountPercent] = useState(initialDiscountPercent)
  const [stockQty, setStockQty] = useState(existingProduct?.stock_qty?.toString() ?? '0')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [existingImages, setExistingImages] = useState<{ id: string; image_url: string; sort_order: number }[]>([])

  // Fetch existing additional images when editing
  useEffect(() => {
    if (existingProduct?.id) {
      fetchExistingImages()
    }
  }, [existingProduct?.id])

  async function fetchExistingImages() {
    const { data } = await supabase
      .from('product_images')
      .select('id, image_url, sort_order')
      .eq('product_id', existingProduct!.id)
      .order('sort_order', { ascending: true })
    setExistingImages(data ?? [])
  }

  async function uploadImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName)

    return data.publicUrl
  }

  function handleImageFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const oversizedFile = files.find((file) => file.size > MAX_FILE_SIZE)
    if (oversizedFile) {
      setError('This photo is larger than 15MB — please choose a smaller file')
      e.target.value = ''
      return
    }
    setError('')
    setImageFiles(files)
  }

  function removeImageFile(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function removeExistingImage(imageId: string) {
    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId)
    if (!error) {
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const oversizedFile = imageFiles.find((file) => file.size > MAX_FILE_SIZE)
    if (oversizedFile) {
      setError('This photo is larger than 15MB — please choose a smaller file')
      return
    }

    setUploading(true)

    try {
      let imageUrl = existingProduct?.image_url ?? null
      let productId = existingProduct?.id

      // Upload new images
      const uploadedUrls: string[] = []
      for (const file of imageFiles) {
        const url = await uploadImage(file)
        uploadedUrls.push(url)
      }

      // Set primary image (first uploaded or existing)
      if (uploadedUrls.length > 0) {
        imageUrl = uploadedUrls[0]
      }

      const parsedPrice = parseFloat(price)
      const parsedDiscount = discountPercent ? parseFloat(discountPercent) : 0

      let finalPrice = Math.round(parsedPrice)
      let compareAtPrice: number | null = null

      if (!isNaN(parsedDiscount) && parsedDiscount > 0 && parsedDiscount < 100) {
        compareAtPrice = Math.round(parsedPrice)
        finalPrice = Math.round(parsedPrice - (parsedPrice * parsedDiscount / 100))
      } else {
        compareAtPrice = null
        finalPrice = Math.round(parsedPrice)
      }

      const productData: NewProduct = {
        name,
        category: category || null,
        material: material || null,
        description: description || null,
        care_instructions: careInstructions || null,
        dimensions: dimensions || null,
        price: finalPrice,
        compare_at_price: compareAtPrice,
        stock_qty: parseInt(stockQty, 10),
        sold: existingProduct?.sold ?? false,
        image_url: imageUrl,
      }

      if (existingProduct) {
        const { error: updateError } = await supabase
          .from('products')
          .update(productData)
          .eq('id', existingProduct.id)
        if (updateError) throw updateError
      } else {
        const { data: newProduct } = await supabase
          .from('products')
          .insert(productData)
          .select('id')
          .single()
        if (newProduct) {
          productId = newProduct.id
        }
      }

      // Insert additional images into product_images table
      if (productId && uploadedUrls.length > 1) {
        const additionalImages = uploadedUrls.slice(1).map((url, index) => ({
          product_id: productId,
          image_url: url,
          sort_order: existingImages.length + index,
        }))
        await supabase.from('product_images').insert(additionalImages)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 border border-[#E4DDD1] space-y-6 rounded-none relative max-w-2xl mx-auto">
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#B8874B]" />
      
      <h2 className="font-fraunces text-xl sm:text-2xl font-normal text-[#2B2420]">
        {existingProduct ? 'Edit Product' : 'Add New Product'}
      </h2>

      {error && (
        <div className="bg-[#4A3728]/5 border border-[#E4DDD1] text-xs text-[#4A3728] p-3 text-center leading-relaxed">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Product Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors placeholder-[#6B7259]/40"
          >
            <option value="Bed">Bed</option>
            <option value="Chair">Chair</option>
            <option value="Dining Table Set">Dining Table Set</option>
            <option value="Sofa / Recliner">Sofa / Recliner</option>
            <option value="TV Unit">TV Unit</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Material</label>
          <input
            type="text"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="Teak wood, Fabric..."
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors placeholder-[#6B7259]/40"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Price (₹)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            min="0"
            step="0.01"
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Discount %</label>
          <input
            type="number"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            placeholder="e.g. 15"
            min="0"
            max="99"
            step="1"
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors placeholder-[#6B7259]/40"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Stock Quantity</label>
          <input
            type="number"
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
            required
            min="0"
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
          />
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">About this Product</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors resize-y"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Care Instructions</label>
          <textarea
            value={careInstructions}
            onChange={(e) => setCareInstructions(e.target.value)}
            rows={4}
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors resize-y"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Dimensions</label>
          <input
            type="text"
            value={dimensions}
            onChange={(e) => setDimensions(e.target.value)}
            placeholder="154 x 210 x 77 cm"
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors placeholder-[#6B7259]/40"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
          Product Photos (multiple allowed)
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleImageFilesChange}
          className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors file:mr-4 file:py-1.5 file:px-3 file:border file:border-[#E4DDD1] file:text-xs file:uppercase file:tracking-wider file:font-semibold file:bg-white file:text-[#2B2420] hover:file:bg-[#FAF7F2]"
          disabled={uploading}
        />
        
        {/* New image previews */}
        {imageFiles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {imageFiles.map((file, index) => (
              <div key={index} className="relative">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`New ${index + 1}`}
                  className="h-20 w-20 object-cover border border-[#E4DDD1]"
                />
                <button
                  type="button"
                  onClick={() => removeImageFile(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
                {index === 0 && (
                  <span className="absolute bottom-1 left-1 bg-[#B8874B] text-white text-xs px-1.5 py-0.5 rounded">
                    Cover
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Existing primary image */}
        {existingProduct?.image_url && (
          <div className="mt-3">
            <p className="text-xs text-[#6B7259] mb-2">Current Cover Image:</p>
            <div className="p-1.5 border border-[#E4DDD1] inline-block bg-[#FAF7F2] relative">
              <img
                src={existingProduct.image_url}
                alt="Current cover"
                className="h-20 w-20 object-cover"
              />
              <span className="absolute bottom-2 left-2 bg-[#B8874B] text-white text-xs px-1.5 py-0.5 rounded">
                Cover
              </span>
            </div>
          </div>
        )}

        {/* Existing additional images */}
        {existingImages.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-[#6B7259] mb-2">Additional Images:</p>
            <div className="flex flex-wrap gap-2">
              {existingImages.map((img) => (
                <div key={img.id} className="relative">
                  <img
                    src={img.image_url}
                    alt={`Existing ${img.sort_order}`}
                    className="h-20 w-20 object-cover border border-[#E4DDD1]"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(img.id)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4 border-t border-[#E4DDD1] flex-col sm:flex-row">
        <button
          type="submit"
          disabled={uploading}
          className="bg-[#4A3728] hover:bg-[#2B2420] text-[#FAF7F2] px-6 py-3 text-xs uppercase tracking-widest font-semibold rounded-none disabled:opacity-50 transition-colors duration-300 cursor-pointer min-h-[44px]"
        >
          {uploading ? 'Saving...' : existingProduct ? 'Update Product' : 'Add Product'}
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

export default ProductForm
