import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Worker } from '../lib/types'
import { getPresentDays, toggleDayAttendance, calculateLivePayable } from '../lib/dailyPayroll'
import { useToast } from '../context/ToastContext'

interface AttendanceCalendarProps {
  worker: Worker
  onAgreedDaysUpdated?: () => void
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

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AttendanceCalendar({ worker, onAgreedDaysUpdated }: AttendanceCalendarProps) {
  const { showToast } = useToast()

  const today = useMemo(() => new Date(), [])
  const currentMonth = today.getMonth() + 1 // 1-12
  const currentYear = today.getFullYear()
  const todayDay = today.getDate()

  const [presentDays, setPresentDays] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [togglingDay, setTogglingDay] = useState<number | null>(null)

  const [agreedWorkingDays, setAgreedWorkingDays] = useState<number | null>(null)
  const [agreedDaysInput, setAgreedDaysInput] = useState<string>('26')
  const [savingAgreedDays, setSavingAgreedDays] = useState(false)
  const [isEditingAgreedDays, setIsEditingAgreedDays] = useState(false)

  const [livePayable, setLivePayable] = useState<number | null>(null)

  // Total days in current month
  const totalDaysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth, 0).getDate()
  }, [currentYear, currentMonth])

  // Offset for first day of month (Monday = 0, Sunday = 6)
  const startDayOffset = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay()
    return (firstDay + 6) % 7
  }, [currentYear, currentMonth])

  // Parse worker's joining date
  const joiningDateParsed = useMemo(() => {
    if (!worker.joining_date) return { year: 1970, month: 1, day: 1 }
    const parts = worker.joining_date.split('T')[0].split('-').map((s) => parseInt(s, 10))
    return {
      year: parts[0] || 1970,
      month: parts[1] || 1,
      day: parts[2] || 1,
    }
  }, [worker.joining_date])

  // Format joining date for display
  const formattedJoiningDate = useMemo(() => {
    if (!worker.joining_date) return '—'
    const dateOnly = worker.joining_date.split('T')[0]
    const [y, m, d] = dateOnly.split('-').map((s) => parseInt(s, 10))
    if (!y || !m || !d) return dateOnly
    return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`
  }, [worker.joining_date])

  // Load initial attendance and agreed working days
  useEffect(() => {
    loadAttendanceData()
  }, [worker.id, currentMonth, currentYear])

  async function loadAttendanceData() {
    setLoading(true)
    try {
      // 1. Fetch present days
      const days = await getPresentDays(worker.id, currentMonth, currentYear)
      setPresentDays(new Set(days))

      // 2. Fetch agreed working days from monthly attendance table
      const { data: attRecord, error: attError } = await supabase
        .from('attendance')
        .select('agreed_working_days')
        .eq('worker_id', worker.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()

      if (attError) throw attError

      if (attRecord && attRecord.agreed_working_days != null) {
        setAgreedWorkingDays(attRecord.agreed_working_days)
        setAgreedDaysInput(attRecord.agreed_working_days.toString())
      } else {
        setAgreedWorkingDays(null)
        setAgreedDaysInput('26')
      }

      // 3. Fetch live payable
      const payable = await calculateLivePayable(
        worker.id,
        worker.monthly_salary,
        currentMonth,
        currentYear
      )
      setLivePayable(payable)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load attendance data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Check if a day is disabled
  function isDayDisabled(day: number): { disabled: boolean; reason?: string } {
    // Days before joining date
    const isBeforeJoining =
      currentYear < joiningDateParsed.year ||
      (currentYear === joiningDateParsed.year && currentMonth < joiningDateParsed.month) ||
      (currentYear === joiningDateParsed.year &&
        currentMonth === joiningDateParsed.month &&
        day < joiningDateParsed.day)

    if (isBeforeJoining) {
      return { disabled: true, reason: 'Before joining date' }
    }

    // Days in future (after today)
    if (day > todayDay) {
      return { disabled: true, reason: 'Future date' }
    }

    return { disabled: false }
  }

  // Toggle single day attendance
  async function handleToggleDay(day: number) {
    const { disabled } = isDayDisabled(day)
    if (disabled || togglingDay !== null) return

    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isCurrentlyPresent = presentDays.has(day)
    const nextPresent = !isCurrentlyPresent

    // Optimistic update
    const nextPresentSet = new Set(presentDays)
    if (nextPresent) {
      nextPresentSet.add(day)
    } else {
      nextPresentSet.delete(day)
    }
    setPresentDays(nextPresentSet)
    setTogglingDay(day)

    try {
      await toggleDayAttendance(worker.id, dateStr, nextPresent)

      // Recalculate live payable
      const payable = await calculateLivePayable(
        worker.id,
        worker.monthly_salary,
        currentMonth,
        currentYear
      )
      setLivePayable(payable)
      showToast(
        `Marked ${MONTH_NAMES[currentMonth - 1]} ${day} as ${nextPresent ? 'Present' : 'Absent'}.`,
        'success'
      )
    } catch (err) {
      // Rollback
      setPresentDays(presentDays)
      showToast(err instanceof Error ? err.message : 'Failed to update attendance', 'error')
    } finally {
      setTogglingDay(null)
    }
  }

  // Save agreed working days for this month
  async function handleSaveAgreedDays(e: React.FormEvent) {
    e.preventDefault()
    const daysNum = parseFloat(agreedDaysInput)
    if (isNaN(daysNum) || daysNum <= 0) {
      showToast('Agreed working days must be a positive number.', 'error')
      return
    }

    setSavingAgreedDays(true)
    try {
      // Check if attendance record exists for this worker/month/year
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('worker_id', worker.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()

      if (existing) {
        const { error: updateError } = await supabase
          .from('attendance')
          .update({ agreed_working_days: daysNum })
          .eq('id', existing.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('attendance')
          .insert({
            worker_id: worker.id,
            month: currentMonth,
            year: currentYear,
            agreed_working_days: daysNum,
            days_present: presentDays.size,
          })

        if (insertError) throw insertError
      }

      setAgreedWorkingDays(daysNum)
      setIsEditingAgreedDays(false)

      // Recalculate live payable
      const payable = await calculateLivePayable(
        worker.id,
        worker.monthly_salary,
        currentMonth,
        currentYear
      )
      setLivePayable(payable)

      showToast(`Agreed working days set to ${daysNum} days.`, 'success')
      if (onAgreedDaysUpdated) {
        onAgreedDaysUpdated()
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save agreed working days', 'error')
    } finally {
      setSavingAgreedDays(false)
    }
  }

  const daysPresentCount = presentDays.size
  const remainingWorkingDays =
    agreedWorkingDays !== null ? agreedWorkingDays - daysPresentCount : null

  return (
    <div className="space-y-6 font-inter text-[#2B2420]">
      {/* Worker Overview Card */}
      <div className="bg-[#FAF7F2] border border-[#E4DDD1] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-fraunces text-lg text-[#2B2420] font-normal leading-tight">
              {worker.name}
            </h3>
            {worker.phone && <p className="text-xs text-[#6B7259] mt-0.5">{worker.phone}</p>}
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#6B7259] block">
              Base Monthly
            </span>
            <span className="font-fraunces text-base font-semibold text-[#B8874B]">
              ₹{worker.monthly_salary.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#E4DDD1]/60 flex items-center justify-between text-xs text-[#6B7259]">
          <span>
            Joining Date: <strong className="text-[#2B2420]">{formattedJoiningDate}</strong>
          </span>
          <span>
            Current Period: <strong className="text-[#2B2420]">{MONTH_NAMES[currentMonth - 1]} {currentYear}</strong>
          </span>
        </div>
      </div>

      {/* Quick Summary Row: Present / Agreed / Remaining */}
      <div className="grid grid-cols-3 gap-2 bg-[#FAF7F2] border border-[#E4DDD1] p-3 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#6B7259]">
            Days Present
          </div>
          <div className="text-base font-bold text-[#4E7A58] mt-0.5 font-inter">
            {daysPresentCount}
          </div>
        </div>
        <div className="border-x border-[#E4DDD1]">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#6B7259]">
            Agreed Working Days
          </div>
          <div className="text-base font-bold text-[#2B2420] mt-0.5 font-inter">
            {agreedWorkingDays !== null ? agreedWorkingDays : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#6B7259]">
            Remaining Working Days
          </div>
          <div
            className={`text-base font-bold mt-0.5 font-inter ${
              remainingWorkingDays !== null
                ? remainingWorkingDays <= 0
                  ? 'text-[#4E7A58]'
                  : 'text-[#B8874B]'
                : 'text-[#6B7259]'
            }`}
          >
            {remainingWorkingDays !== null ? remainingWorkingDays : '—'}
          </div>
        </div>
      </div>

      {/* Calendar Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-semibold text-[#6B7259]">
              Daily Attendance ({MONTH_NAMES[currentMonth - 1]} {currentYear})
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#6B7259]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4E7A58]" /> Present
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FAF7F2] border border-[#E4DDD1]" /> Absent
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center bg-[#FAF7F2] border border-[#E4DDD1]">
            <p className="text-xs text-[#6B7259]">Loading calendar...</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E4DDD1] p-3">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center">
              {WEEKDAY_NAMES.map((w) => (
                <div
                  key={w}
                  className="py-1 text-[10px] font-bold uppercase tracking-wider text-[#6B7259]"
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Calendar Grid Cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {/* Empty leading cells */}
              {Array.from({ length: startDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="h-10 bg-[#FAF7F2]/40 rounded-none border border-transparent" />
              ))}

              {/* Day cells */}
              {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                const day = i + 1
                const isPresent = presentDays.has(day)
                const isToday = day === todayDay
                const { disabled, reason } = isDayDisabled(day)
                const isToggling = togglingDay === day

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    disabled={disabled || isToggling}
                    onClick={() => handleToggleDay(day)}
                    title={
                      disabled
                        ? `${day} ${MONTH_NAMES[currentMonth - 1]}: ${reason}`
                        : `${day} ${MONTH_NAMES[currentMonth - 1]}: Click to mark ${isPresent ? 'Absent' : 'Present'}`
                    }
                    className={`
                      relative h-11 flex flex-col items-center justify-center text-xs font-semibold transition-all select-none
                      ${
                        disabled
                          ? 'bg-[#F4EFEA]/70 text-[#B8AF9F] border border-dashed border-[#E4DDD1]/70 cursor-not-allowed opacity-60'
                          : isPresent
                          ? 'bg-[#4E7A58] text-white border border-[#3E6547] shadow-sm hover:bg-[#436C4D] cursor-pointer'
                          : 'bg-[#FAF7F2] text-[#2B2420] border border-[#E4DDD1] hover:border-[#B8874B] hover:bg-[#FAF7F2] cursor-pointer'
                      }
                      ${isToday && !isPresent ? 'ring-2 ring-[#B8874B] ring-offset-1 font-bold' : ''}
                      ${isToday && isPresent ? 'ring-2 ring-[#B8874B] ring-offset-1' : ''}
                    `}
                  >
                    <span>{day}</span>
                    {isPresent && (
                      <svg
                        className="w-3 h-3 mt-0.5 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {isToday && (
                      <span
                        className={`text-[8px] uppercase tracking-tighter leading-none ${
                          isPresent ? 'text-white/80' : 'text-[#B8874B]'
                        }`}
                      >
                        Today
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Agreed Working Days Configuration */}
      {agreedWorkingDays === null || isEditingAgreedDays ? (
        <form
          onSubmit={handleSaveAgreedDays}
          className="p-4 bg-[#FAF7F2] border border-[#B8874B]/40 space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-[#B8874B] uppercase tracking-wider">
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Set Agreed Working Days for {MONTH_NAMES[currentMonth - 1]}</span>
          </div>
          <p className="text-xs text-[#6B7259] leading-relaxed">
            Please set the scheduled working days for this month (e.g. 26 days) to calculate payable salary accurately.
          </p>

          <div className="flex items-center gap-3">
            <div className="w-36">
              <input
                type="number"
                min="1"
                step="0.5"
                value={agreedDaysInput}
                onChange={(e) => setAgreedDaysInput(e.target.value)}
                required
                placeholder="e.g. 26"
                className="w-full border border-[#E4DDD1] bg-white text-[#2B2420] p-2 text-sm focus:outline-none focus:border-[#B8874B]"
              />
            </div>
            <button
              type="submit"
              disabled={savingAgreedDays}
              className="bg-[#B8874B] hover:bg-[#A3743C] text-white px-4 py-2 text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50"
            >
              {savingAgreedDays ? 'Saving...' : 'Save Days'}
            </button>
            {isEditingAgreedDays && agreedWorkingDays !== null && (
              <button
                type="button"
                onClick={() => setIsEditingAgreedDays(false)}
                className="border border-[#E4DDD1] bg-white text-[#6B7259] px-3 py-2 text-xs uppercase tracking-wider font-semibold"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="p-3 bg-[#FAF7F2] border border-[#E4DDD1] flex items-center justify-between text-xs">
          <span className="text-[#6B7259]">
            Agreed Working Days for {MONTH_NAMES[currentMonth - 1]}:{' '}
            <strong className="text-[#2B2420]">{agreedWorkingDays} days</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setAgreedDaysInput(agreedWorkingDays.toString())
              setIsEditingAgreedDays(true)
            }}
            className="text-[11px] uppercase tracking-wider font-semibold text-[#B8874B] hover:underline"
          >
            Edit
          </button>
        </div>
      )}

      {/* Live Payroll Summary Card */}
      <div className="p-4 bg-[#FAF7F2] border border-[#E4DDD1] space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-[#6B7259] font-bold">
          Live Month-to-Date Summary
        </div>

        <div className="grid grid-cols-2 gap-4 pt-1">
          <div>
            <div className="text-xs text-[#6B7259]">Days Present This Month:</div>
            <div className="font-fraunces text-2xl text-[#2B2420] font-semibold mt-0.5">
              {presentDays.size}{' '}
              <span className="text-xs font-normal text-[#6B7259] font-inter">
                {agreedWorkingDays ? `/ ${agreedWorkingDays} days` : 'days'}
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs text-[#6B7259]">Estimated Payable So Far:</div>
            <div className="font-fraunces text-2xl text-[#B8874B] font-semibold mt-0.5">
              {livePayable !== null ? (
                `₹${livePayable.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
              ) : (
                <span className="text-xs font-normal text-[#C0523C] font-inter italic">
                  Set agreed days first
                </span>
              )}
            </div>
          </div>
        </div>

        {agreedWorkingDays && livePayable !== null && (
          <div className="pt-2 border-t border-[#E4DDD1]/60 flex items-center justify-between text-[11px] text-[#6B7259]">
            <span>Per Day Rate: ₹{Math.round(worker.monthly_salary / agreedWorkingDays).toLocaleString('en-IN')}</span>
            <span>Formula: Base − ((Agreed − Present) × Day Rate)</span>
          </div>
        )}
      </div>
    </div>
  )
}
