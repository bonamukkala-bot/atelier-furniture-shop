import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Worker } from '../lib/types'
import { useToast } from '../context/ToastContext'
import { AnimatePresence, motion } from 'framer-motion'

interface WorkerListProps {
  onEdit: (worker: Worker) => void
  onMarkAttendance?: (worker: Worker) => void
  refreshKey: number
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
interface DeleteConfirmProps {
  workerName: string
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmModal({ workerName, onConfirm, onCancel }: DeleteConfirmProps) {
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
            Delete Worker?
          </h3>
          <p style={{ fontSize: 13, color: '#6B7259', lineHeight: 1.55, margin: '0 0 28px' }}>
            Delete <strong style={{ color: '#2B2420' }}>"{workerName}"</strong>? This will permanently remove this worker AND all of their historical attendance and payroll records. This cannot be undone.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '9px 18px',
                background: '#FAF7F2',
                border: '1px solid #E4DDD1',
                borderRadius: 2,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#6B7259',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: '9px 18px',
                background: '#C0523C',
                border: 'none',
                borderRadius: 2,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Delete Worker
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function WorkerList({ onEdit, onMarkAttendance, refreshKey }: WorkerListProps) {
  const { showToast } = useToast()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingWorker, setDeletingWorker] = useState<Worker | null>(null)

  useEffect(() => {
    fetchWorkers()
  }, [refreshKey])

  async function fetchWorkers() {
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('workers')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setWorkers(data ?? [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch workers'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error: deleteError } = await supabase
        .from('workers')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setWorkers((prev) => prev.filter((w) => w.id !== id))
      showToast('Worker deleted successfully.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete worker', 'error')
    } finally {
      setDeletingWorker(null)
    }
  }

  const displayedWorkers = useMemo(() => {
    if (!searchQuery.trim()) return workers
    const q = searchQuery.toLowerCase()
    return workers.filter((w) =>
      w.name.toLowerCase().includes(q) || (w.phone && w.phone.toLowerCase().includes(q))
    )
  }, [workers, searchQuery])

  if (loading) {
    return (
      <p style={{ color: '#6B7259', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        Loading workers...
      </p>
    )
  }

  if (error) {
    return (
      <p style={{ color: '#C0523C', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        Error: {error}
      </p>
    )
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Delete Confirmation Modal */}
      {deletingWorker && (
        <DeleteConfirmModal
          workerName={deletingWorker.name}
          onConfirm={() => handleDelete(deletingWorker.id)}
          onCancel={() => setDeletingWorker(null)}
        />
      )}

      {/* Top Controls: Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <svg
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6B7259',
              pointerEvents: 'none',
            }}
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search workers by name or phone..."
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

        <div style={{ fontSize: 12, color: '#6B7259', fontWeight: 500 }}>
          Total: {displayedWorkers.length} worker{displayedWorkers.length === 1 ? '' : 's'}
        </div>
      </div>

      {displayedWorkers.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: '#FAF7F2',
            border: '1px solid #E4DDD1',
          }}
        >
          <p style={{ color: '#6B7259', fontSize: 13, margin: 0 }}>
            {searchQuery ? 'No workers matching your search.' : 'No workers added yet.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            overflow: 'hidden',
            border: '1px solid #E4DDD1',
            borderRadius: 2,
            overflowX: 'auto',
          }}
        >
          <table
            style={{
              width: '100%',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#FAF7F2',
                  borderBottom: '1px solid #E4DDD1',
                }}
              >
                {['Name', 'Phone', 'Joining Date', 'Monthly Salary', 'Actions'].map((h, idx) => (
                  <th
                    key={h}
                    style={{
                      padding: '11px 16px',
                      textAlign: idx === 4 ? 'right' : 'left',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#6B7259',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedWorkers.map((worker, i) => (
                <tr
                  key={worker.id}
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid #F0EBE4',
                    background: i % 2 === 0 ? '#fff' : '#FDFAF7',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF7F2')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FDFAF7')
                  }
                >
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontWeight: 600, color: '#2B2420' }}>{worker.name}</span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#6B7259' }}>
                    {worker.phone || '—'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#6B7259', fontSize: 12 }}>
                    {worker.joining_date ? worker.joining_date.split('T')[0] : '—'}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#B8874B' }}>
                    ₹{Math.round(worker.monthly_salary).toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      {onMarkAttendance && (
                        <button
                          onClick={() => onMarkAttendance(worker)}
                          title="Open Daily Attendance Calendar"
                          style={{
                            padding: '6px 10px',
                            background: '#4E7A58',
                            border: 'none',
                            borderRadius: 2,
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            transition: 'background 0.18s',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#436C4D'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#4E7A58'
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          Daily Check-in
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(worker)}
                        style={{
                          padding: '6px 10px',
                          background: '#FAF7F2',
                          border: '1px solid #E4DDD1',
                          borderRadius: 2,
                          color: '#4A3728',
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          transition: 'border-color 0.18s, color 0.18s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#B8874B'
                          e.currentTarget.style.color = '#B8874B'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#E4DDD1'
                          e.currentTarget.style.color = '#4A3728'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingWorker(worker)}
                        style={{
                          padding: '6px 10px',
                          background: 'rgba(192,82,60,0.06)',
                          border: '1px solid rgba(192,82,60,0.2)',
                          borderRadius: 2,
                          color: '#C0523C',
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          transition: 'background 0.18s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(192,82,60,0.12)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(192,82,60,0.06)'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default WorkerList
