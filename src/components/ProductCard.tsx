import { useState } from 'react'
import type { Product } from '../lib/types'

interface ProductCardProps {
  product: Product
  images: string[]
  onEdit: (product: Product) => void
  onToggleSold: (product: Product) => void
  onDelete: (product: Product) => void
}

function ProductCard({ product, images, onEdit, onToggleSold, onDelete }: ProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageHovered, setImageHovered] = useState(false)
  const currentImageUrl = images[currentImageIndex] || product.image_url

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  return (
    <div
      style={{
        background: '#FAF7F2',
        border: '1px solid #E4DDD1',
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s',
        boxShadow: '0 1px 4px rgba(74,55,40,0.05)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(74,55,40,0.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(74,55,40,0.05)')}
    >
      {/* Image */}
      <div
        style={{ position: 'relative', width: '100%', height: 160 }}
        onMouseEnter={() => setImageHovered(true)}
        onMouseLeave={() => setImageHovered(false)}
      >
        {currentImageUrl ? (
          <img
            src={currentImageUrl}
            alt={product.name}
            style={{ width: '100%', height: 160, objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: 160,
              background: '#E4DDD1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6B7259',
              fontSize: 12,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            No image
          </div>
        )}

        {/* Image navigation controls */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Show previous product image"
              onClick={handlePrevImage}
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 28,
                height: 28,
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid #E4DDD1',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: imageHovered ? 1 : 0,
                transition: 'opacity 0.2s',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Show next product image"
              onClick={handleNextImage}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 28,
                height: 28,
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid #E4DDD1',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: imageHovered ? 1 : 0,
                transition: 'opacity 0.2s',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 2,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {currentImageIndex + 1}/{images.length}
            </div>
          </>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3
            style={{
              fontFamily: 'Fraunces, serif',
              fontSize: 16,
              fontWeight: 400,
              color: '#2B2420',
              margin: 0,
            }}
          >
            {product.name}
          </h3>
          {product.sold && (
            <span
              style={{
                background: 'rgba(192,82,60,0.1)',
                color: '#C0523C',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: 2,
                flexShrink: 0,
                marginLeft: 8,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Sold
            </span>
          )}
        </div>

        <p
          style={{
            fontSize: 11,
            color: '#6B7259',
            margin: 0,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {product.category}
          {product.material && ` • ${product.material}`}
        </p>

        <p
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#B8874B',
            margin: '4px 0 0',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          ₹{product.price.toLocaleString('en-IN')}
        </p>

        <p
          style={{
            fontSize: 11,
            color: '#6B7259',
            margin: 0,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Stock: {product.stock_qty.toString()}
        </p>
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 16px',
          borderTop: '1px solid #E4DDD1',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => onEdit(product)}
          style={{
            flex: 1,
            padding: '7px 10px',
            background: '#4A3728',
            color: '#FAF7F2',
            border: 'none',
            borderRadius: 2,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'background 0.18s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#2B2420')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#4A3728')}
        >
          Edit
        </button>
        <button
          onClick={() => onToggleSold(product)}
          style={{
            flex: 1,
            padding: '7px 10px',
            background: product.sold ? 'rgba(107,114,89,0.1)' : 'rgba(184,135,75,0.1)',
            color: product.sold ? '#6B7259' : '#B8874B',
            border: `1px solid ${product.sold ? '#C8CFBB' : '#D4A96E'}`,
            borderRadius: 2,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'background 0.18s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {product.sold ? 'Mark Unsold' : 'Mark Sold'}
        </button>
        <button
          onClick={() => onDelete(product)}
          style={{
            padding: '7px 10px',
            background: 'rgba(192,82,60,0.08)',
            color: '#C0523C',
            border: '1px solid rgba(192,82,60,0.25)',
            borderRadius: 2,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'background 0.18s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,82,60,0.14)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(192,82,60,0.08)')}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export default ProductCard
