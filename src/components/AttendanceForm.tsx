import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Worker, NewAttendance } from '../lib/types'
import { calculatePayable } from '../lib/payroll'
import { getPresentDays } from '../lib/dailyPayroll'

interface AttendanceFormProps {
  initialWorkerId?: string
  initialMonth?: number
  initialYear?: number
  onSuccess: (msg?: string) => void
  onCancel: () => void
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function AttendanceForm({
  initialWorkerId,
  initialMonth,
  initialYear,
  onSuccess,
  onCancel,
}: AttendanceFormProps) {
  const currentDate = new Date()
  const defaultMonth = initialMonth ?? currentDate.getMonth() + 1
  const defaultYear = initialYear ?? currentDate.getFullYear()

  const [workers, setWorkers] = useState<Worker[]>([])
  const [workersLoading, setWorkersLoading] = useState(true)

  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(initialWorkerId ?? '')
  const [month, setMonth] = useState<number>(defaultMonth)
  const [year, setYear] = useState<number>(defaultYear)
  const [agreedWorkingDays, setAgreedWorkingDays] = useState<string>('26')
  const [existingAttendanceId, setExistingAttendanceId] = useState<string | null>(null)
  const [liveDailyPresentCount, setLiveDailyPresentCount] = useState<number>(0)

  const [loading, setLoading] = useState(false)
  const [fetchingExisting, setFetchingExisting] = useState(false)
  const [error, setError] = useState('')

  // Year options: current year - 2 to current year + 2
  const yearOptions = useMemo(() => {
    const current = currentDate.getFullYear()
    return [current - 2, current - 1, current, current + 1, current + 2]
  }, [])

  // Fetch all workers
  useEffect(() => {
    async function loadWorkers() {
      setWorkersLoading(true)
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('name', { ascending: true })

      if (!error && data) {
        setWorkers(data)
        if (!selectedWorkerId && data.length > 0) {
          setSelectedWorkerId(initialWorkerId || data[0].id)
        }
      }
      setWorkersLoading(false)
    }
    loadWorkers()
  }, [])

  // When worker, month, or year changes, check if an agreed working days record exists and get live daily attendance count
  useEffect(() => {
    if (!selectedWorkerId) return

    async function checkExistingRecord() {
      setFetchingExisting(true)
      try {
        // Fetch existing attendance record
        const { data } = await supabase
          .from('attendance')
          .select('*')
          .eq('worker_id', selectedWorkerId)
          .eq('month', month)
          .eq('year', year)
          .maybeSingle()

        if (data) {
          setExistingAttendanceId(data.id)
          setAgreedWorkingDays(data.agreed_working_days.toString())
        } else {
          setExistingAttendanceId(null)
          setAgreedWorkingDays('26')
        }

        // Fetch live present days from daily_attendance
        const presentDays = await getPresentDays(selectedWorkerId, month, year)
        setLiveDailyPresentCount(presentDays.length)
      } catch (err) {
        console.error('Error fetching attendance info:', err)
      } finally {
        setFetchingExisting(false)
      }
    }

    checkExistingRecord()
  }, [selectedWorkerId, month, year])

  // Selected worker object
  const selectedWorker = useMemo(() => {
    return workers.find((w) => w.id === selectedWorkerId)
  }, [workers, selectedWorkerId])

  // Live estimated payable amount
  const estimatedPayable = useMemo(() => {
    if (!selectedWorker) return null
    const agreed = parseFloat(agreedWorkingDays)
    if (isNaN(agreed) || agreed <= 0) {
      return null
    }
    return calculatePayable(selectedWorker.monthly_salary, agreed, liveDailyPresentCount)
  }, [selectedWorker, liveDailyPresentCount, agreedWorkingDays])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!selectedWorkerId) {
      setError('Please select a worker.')
      return
    }

    const agreedNum = parseFloat(agreedWorkingDays)
    if (isNaN(agreedNum) || agreedNum <= 0) {
      setError('Agreed working days must be greater than 0.')
      return
    }

    setLoading(true)

    const payload: NewAttendance = {
      worker_id: selectedWorkerId,
      month,
      year,
      days_present: liveDailyPresentCount,
      agreed_working_days: agreedNum,
    }

    try {
      if (existingAttendanceId) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('attendance')
          .update({ agreed_working_days: agreedNum })
          .eq('id', existingAttendanceId)

        if (updateError) throw updateError
        onSuccess('Agreed working days updated successfully.')
      } else {
        // Attempt insert
        const { error: insertError } = await supabase
          .from('attendance')
          .insert(payload)

        if (insertError) {
          // If unique constraint violation occurred (e.g. race condition), update instead
          if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
            const { error: fallbackUpdateError } = await supabase
              .from('attendance')
              .update({ agreed_working_days: agreedNum })
              .eq('worker_id', selectedWorkerId)
              .eq('month', month)
              .eq('year', year)

            if (fallbackUpdateError) throw fallbackUpdateError
            onSuccess('Agreed working days updated successfully.')
          } else {
            throw insertError
          }
        } else {
          onSuccess('Agreed working days set successfully.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agreed working days.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 font-inter">
      {error && (
        <div className="bg-[#C0523C]/10 border border-[#C0523C]/30 text-xs text-[#C0523C] p-3 leading-relaxed">
          {error}
        </div>
      )}

      {existingAttendanceId && (
        <div className="bg-[#B8874B]/10 border border-[#B8874B]/30 text-xs text-[#4A3728] p-3 leading-relaxed">
          Agreed working days for <strong>{MONTH_NAMES[month - 1]} {year}</strong> are already configured. Submitting will update the setting.
        </div>
      )}

      {/* Worker Dropdown */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
          Select Worker <span className="text-[#C0523C]">*</span>
        </label>
        {workersLoading ? (
          <p className="text-xs text-[#6B7259]">Loading workers...</p>
        ) : workers.length === 0 ? (
          <p className="text-xs text-[#C0523C]">No workers found. Please add a worker first.</p>
        ) : (
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            required
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
          >
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} — (Base: ₹{w.monthly_salary.toLocaleString('en-IN')}/mo)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Month & Year Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
            Month <span className="text-[#C0523C]">*</span>
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            required
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
            Year <span className="text-[#C0523C]">*</span>
          </label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            required
            className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Agreed Working Days */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">
          Agreed Working Days for This Month <span className="text-[#C0523C]">*</span>
        </label>
        <input
          type="number"
          min="1"
          step="0.5"
          value={agreedWorkingDays}
          onChange={(e) => setAgreedWorkingDays(e.target.value)}
          placeholder="e.g. 26"
          required
          disabled={fetchingExisting}
          className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
        />
        <span className="text-[10px] text-[#6B7259] mt-1 block">
          Total scheduled working days for {MONTH_NAMES[month - 1]} {year} (excluding weekly offs).
        </span>
      </div>

      {/* Daily Attendance Check-In Summary Info */}
      <div className="p-3 bg-[#FAF7F2] border border-[#E4DDD1] flex items-center justify-between text-xs">
        <span className="text-[#6B7259]">
          Days Present from Daily Check-In:
        </span>
        <strong className="text-[#4E7A58] text-sm">
          {liveDailyPresentCount} {liveDailyPresentCount === 1 ? 'day' : 'days'}
        </strong>
      </div>

      {/* Live Estimated Payable Preview Card */}
      {selectedWorker && estimatedPayable !== null && (
        <div className="p-4 bg-[#FAF7F2] border border-[#E4DDD1] rounded-none">
          <div className="text-[10px] uppercase tracking-widest text-[#6B7259] font-semibold mb-1 font-inter">
            Live Calculation Preview
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-[#2B2420] font-medium">Estimated Payable:</span>
            <span className="font-fraunces text-xl font-semibold text-[#B8874B]">
              ₹{estimatedPayable.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[10px] text-[#6B7259] mt-2 pt-2 border-t border-[#E4DDD1]/50 flex justify-between">
            <span>Base Salary: ₹{selectedWorker.monthly_salary.toLocaleString('en-IN')}</span>
            <span>Per Day Rate: ₹{Math.round(selectedWorker.monthly_salary / (parseFloat(agreedWorkingDays) || 1)).toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

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
          disabled={loading || workers.length === 0}
          className="bg-[#B8874B] hover:bg-[#A3743C] text-white px-6 py-2.5 text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50 shadow-sm"
        >
          {loading ? 'Saving...' : existingAttendanceId ? 'Update Agreed Days' : 'Save Agreed Days'}
        </button>
      </div>
    </form>
  )
}

export default AttendanceForm

