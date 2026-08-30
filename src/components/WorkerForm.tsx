import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Worker, NewWorker } from '../lib/types'

interface WorkerFormProps {
  existingWorker?: Worker
  onSuccess: () => void
  onCancel: () => void
}

function WorkerForm({ existingWorker, onSuccess, onCancel }: WorkerFormProps) {
  const [name, setName] = useState(existingWorker?.name ?? '')
  const [phone, setPhone] = useState(existingWorker?.phone ?? '')
  const [monthlySalary, setMonthlySalary] = useState(
    existingWorker?.monthly_salary?.toString() ?? ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Worker name is required.')
      return
    }

    const salaryValue = parseFloat(monthlySalary)
    if (isNaN(salaryValue) || salaryValue < 0) {
      setError('Monthly salary must be a valid number (0 or greater).')
      return
    }

    setLoading(true)

    try {
      const workerData: NewWorker = {
        name: trimmedName,
        phone: phone.trim() ? phone.trim() : null,
        monthly_salary: Math.round(salaryValue),
      }

      if (existingWorker) {
        const { error: updateError } = await supabase
          .from('workers')
          .update(workerData)
          .eq('id', existingWorker.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('workers')
          .insert(workerData)

        if (insertError) throw insertError
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save worker.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 font-inter">
      {error && (
        <div className="bg-[#C0523C]/10 border border-[#C0523C]/30 text-xs text-[#C0523C] p-3 leading-relaxed">
          {error}
        </div>
      )}

      {/* Worker Name */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
          Full Name <span className="text-[#C0523C]">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ramesh Kumar"
          required
          className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
        />
      </div>

      {/* Phone Number */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
          Phone Number <span className="text-[10px] text-[#6B7259]/70 font-normal lowercase">(optional)</span>
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. +91 98765 43210"
          className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
        />
      </div>

      {/* Monthly Salary */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
          Monthly Salary (₹) <span className="text-[#C0523C]">*</span>
        </label>
        <input
          type="number"
          min="0"
          step="1"
          value={monthlySalary}
          onChange={(e) => setMonthlySalary(e.target.value)}
          placeholder="e.g. 20000"
          required
          className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E4DDD1]">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="border border-[#E4DDD1] bg-white text-[#6B7259] hover:text-[#2B2420] px-5 py-2.5 text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="bg-[#B8874B] hover:bg-[#A3743C] text-white px-6 py-2.5 text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50 shadow-sm"
        >
          {loading ? 'Saving...' : existingWorker ? 'Update Worker' : 'Add Worker'}
        </button>
      </div>
    </form>
  )
}

export default WorkerForm
