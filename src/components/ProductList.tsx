import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Product } from '../lib/types'
import { useToast } from '../context/ToastContext'
import { AnimatePresence, motion } from 'framer-motion'
import ProductCard from './ProductCard'

interface ProductListProps {
  onEdit: (product: Product) => void
  refreshKey: number
}

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'stock_asc'

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
interface DeleteConfirmProps {
  productName: string
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmModal({ productName, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(43,36,32,0.45)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff',
            border: '1px solid #E4DDD1',
            borderRadius: 2,
            padding: '32px 28px 24px',
            maxWidth: 400,
            width: '100%',
            boxShadow: '0 8px 40px rgba(43,36,32,0.16)',
            fontFamily: 'Inter, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Destructive red top strip */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#C0523C' }} />

          {/* Icon */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(192,82,60,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              color: '#C0523C',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </div>

          <h3
            style={{
              fontFamily: 'Fraunces, serif',
              fontSize: 20,
              fontWeight: 400,
              color: '#2B2420',
              margin: '0 0 8px',
            }}
          >
            Delete Product?
          </h3>
          <p style={{ fontSize: 13, color: '#6B7259', lineHeight: 1.55, margin: '0 0 28px' }}>
            <strong style={{ color: '#2B2420' }}>"{productName}"</strong> will be permanently deleted.
            This action cannot be undone.
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'transparent',
                border: '1px solid #E4DDD1',
                borderRadius: 2,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#6B7259',
                cursor: 'pointer',
                transition: 'background 0.18s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF7F2')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: '#C0523C',
                border: '1px solid #C0523C',
                borderRadius: 2,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#fff',
                cursor: 'pointer',
                transition: 'background 0.18s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#A8432E')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#C0523C')}
            >
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Product List ───────────────────────────────────────────────────────────────
function ProductList({ onEdit, refreshKey }: ProductListProps) {
  const { showToast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [productImages, setProductImages] = useState<Record<string, string[]>>({})

  // ── Search & Sort state (new — no DB queries) ──
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('newest')

  // ── Filter state ──
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [materialFilter, setMaterialFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'in_stock' | 'sold_out' | 'sold'>('all')

  // ── Delete confirm state (new) ──
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [refreshKey])

  // ── Existing fetch — UNCHANGED ──
  async function fetchProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setProducts(data ?? [])

      // Fetch product images
      if (data && data.length > 0) {
        const productIds = data.map(p => p.id)
        const { data: imagesData } = await supabase
          .from('product_images')
          .select('product_id, image_url, sort_order')
          .in('product_id', productIds)
          .order('sort_order', { ascending: true })

        // Group images by product_id
        const imagesMap: Record<string, string[]> = {}
        imagesData?.forEach(img => {
          if (!imagesMap[img.product_id]) {
            imagesMap[img.product_id] = []
          }
          imagesMap[img.product_id].push(img.image_url)
        })
        setProductImages(imagesMap)
      }
    }
    setLoading(false)
  }

  // ── Existing delete — UNCHANGED logic, replaced confirm/alert with toast ──
  async function handleDelete(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      showToast('Failed to delete: ' + error.message, 'error')
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== id))
      showToast('Product deleted successfully.', 'success')
    }
    setDeletingProduct(null)
  }

  // ── Existing toggleSold — UNCHANGED logic ──
  async function toggleSold(product: Product) {
    const { error } = await supabase
      .from('products')
      .update({ sold: !product.sold })
      .eq('id', product.id)

    if (error) {
      showToast('Failed to update: ' + error.message, 'error')
    } else {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, sold: !p.sold } : p))
      )
      showToast(
        product.sold ? 'Marked as available.' : 'Marked as sold.',
        'success'
      )
    }
  }

  // ── Get distinct categories and materials from fetched products ──
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))
    return Array.from(cats).sort()
  }, [products])

  const materials = useMemo(() => {
    const mats = new Set(products.map((p) => p.material).filter((m): m is string => Boolean(m)))
    return Array.from(mats).sort()
  }, [products])

  // ── Client-side filtered + sorted list (new — no DB queries) ──
  const displayedProducts = useMemo(() => {
    let filtered = products.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.category === categoryFilter)
    }

    // Apply material filter
    if (materialFilter !== 'all') {
      filtered = filtered.filter((p) => p.material === materialFilter)
    }

    // Apply availability filter
    if (availabilityFilter !== 'all') {
      switch (availabilityFilter) {
        case 'in_stock':
          filtered = filtered.filter((p) => !p.sold && p.stock_qty > 0)
          break
        case 'sold_out':
          filtered = filtered.filter((p) => !p.sold && p.stock_qty === 0)
          break
        case 'sold':
          filtered = filtered.filter((p) => p.sold)
          break
      }
    }

    switch (sortOption) {
      case 'price_asc':
        filtered = [...filtered].sort((a, b) => a.price - b.price)
        break
      case 'price_desc':
        filtered = [...filtered].sort((a, b) => b.price - a.price)
        break
      case 'stock_asc':
        filtered = [...filtered].sort((a, b) => a.stock_qty - b.stock_qty)
        break
      case 'newest':
      default:
        // already ordered by created_at desc from fetch
        break
    }

    return filtered
  }, [products, searchQuery, sortOption, categoryFilter, materialFilter, availabilityFilter])

  if (loading)
    return (
      <p style={{ color: '#6B7259', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        Loading products...
      </p>
    )
  if (error)
    return (
      <p style={{ color: '#C0523C', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        Error: {error}
      </p>
    )

  return (
    <>
      {/* ── Delete Confirm Modal ── */}
      {deletingProduct && (
        <DeleteConfirmModal
          productName={deletingProduct.name}
          onConfirm={() => handleDelete(deletingProduct.id)}
          onCancel={() => setDeletingProduct(null)}
        />
      )}

      {/* ── Search + Sort bar ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 24,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <div
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#B8874B',
              pointerEvents: 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: 34,
              paddingRight: 12,
              paddingTop: 9,
              paddingBottom: 9,
              border: '1px solid #E4DDD1',
              borderRadius: 2,
              fontSize: 13,
              color: '#2B2420',
              background: '#FAF7F2',
              outline: 'none',
              fontFamily: 'Inter, sans-serif',
              boxSizing: 'border-box',
              transition: 'border-color 0.18s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
          />
        </div>

        {/* Sort dropdown */}
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          style={{
            padding: '9px 32px 9px 12px',
            border: '1px solid #E4DDD1',
            borderRadius: 2,
            fontSize: 12,
            fontWeight: 600,
            color: '#4A3728',
            background: '#FAF7F2',
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.04em',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234A3728' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '14px',
            flexShrink: 0,
            transition: 'border-color 0.18s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
        >
          <option value="newest">Newest First</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="stock_asc">Stock: Low to High</option>
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: '9px 32px 9px 12px',
            border: '1px solid #E4DDD1',
            borderRadius: 2,
            fontSize: 12,
            fontWeight: 600,
            color: '#4A3728',
            background: '#FAF7F2',
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.04em',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234A3728' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '14px',
            flexShrink: 0,
            transition: 'border-color 0.18s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Material filter */}
        <select
          value={materialFilter}
          onChange={(e) => setMaterialFilter(e.target.value)}
          style={{
            padding: '9px 32px 9px 12px',
            border: '1px solid #E4DDD1',
            borderRadius: 2,
            fontSize: 12,
            fontWeight: 600,
            color: '#4A3728',
            background: '#FAF7F2',
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.04em',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234A3728' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '14px',
            flexShrink: 0,
            transition: 'border-color 0.18s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
        >
          <option value="all">All Materials</option>
          {materials.map((mat) => (
            <option key={mat} value={mat}>
              {mat}
            </option>
          ))}
        </select>

        {/* Availability filter */}
        <select
          value={availabilityFilter}
          onChange={(e) => setAvailabilityFilter(e.target.value as any)}
          style={{
            padding: '9px 32px 9px 12px',
            border: '1px solid #E4DDD1',
            borderRadius: 2,
            fontSize: 12,
            fontWeight: 600,
            color: '#4A3728',
            background: '#FAF7F2',
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.04em',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234A3728' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '14px',
            flexShrink: 0,
            transition: 'border-color 0.18s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
        >
          <option value="all">All Availability</option>
          <option value="in_stock">In Stock</option>
          <option value="sold_out">Sold Out</option>
          <option value="sold">Sold</option>
        </select>

        {/* Result count */}
        {(searchQuery || sortOption !== 'newest' || categoryFilter !== 'all' || materialFilter !== 'all' || availabilityFilter !== 'all') && (
          <span
            style={{
              fontSize: 11,
              color: '#6B7259',
              fontFamily: 'Inter, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            {displayedProducts.length} of {products.length}
          </span>
        )}
      </div>

      {/* ── Empty state ── */}
      {products.length === 0 && (
        <p style={{ color: '#6B7259', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
          No products yet. Add your first one using the button above.
        </p>
      )}
      {products.length > 0 && displayedProducts.length === 0 && (
        <p style={{ color: '#6B7259', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
          No products match your filters — try adjusting your search.
        </p>
      )}

      {/* ── Product grid — same structure, same logic, just Toast for actions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedProducts.map((product) => {
          const images = productImages[product.id] || (product.image_url ? [product.image_url] : [])
          return (
            <ProductCard
              key={product.id}
              product={product}
              images={images}
              onEdit={onEdit}
              onToggleSold={toggleSold}
              onDelete={setDeletingProduct}
            />
          )
        })}
      </div>
    </>
  )
}

export default ProductList