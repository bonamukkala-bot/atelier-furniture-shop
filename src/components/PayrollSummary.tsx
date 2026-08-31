import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Worker, Attendance } from '../lib/types'
import { calculatePayable } from '../lib/payroll'

interface PayrollSummaryProps {
  onRecordAttendance: (workerId?: string, month?: number, year?: number) => void
  onOpenCalendar?: (worker: Worker) => void
  refreshKey: number
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

interface WorkerPayrollRow {
  worker: Worker
  attendance: Attendance | null
  agreedWorkingDays: number | null
  daysPresent: number
  remainingDays: number | null
  payable: number | null
}

function PayrollSummary({ onRecordAttendance, onOpenCalendar, refreshKey }: PayrollSummaryProps) {
  const currentDate = new Date()
  const currentMonthNum = currentDate.getMonth() + 1
  const currentYearNum = currentDate.getFullYear()

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum)
  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum)

  const [workers, setWorkers] = useState<Worker[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [dailyCounts, setDailyCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isCurrentMonth = selectedMonth === currentMonthNum && selectedYear === currentYearNum

  const yearOptions = useMemo(() => {
    const current = currentDate.getFullYear()
    return [current - 2, current - 1, current, current + 1, current + 2]
  }, [])

  useEffect(() => {
    fetchPayrollData()
  }, [selectedMonth, selectedYear, refreshKey])

  async function fetchPayrollData() {
    setLoading(true)
    setError('')
    try {
      // 1. Fetch all workers
      const { data: workersData, error: workersError } = await supabase
        .from('workers')
        .select('*')
        .order('name', { ascending: true })

      if (workersError) throw workersError

      // 2. Fetch monthly attendance records (for agreed_working_days)
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('month', selectedMonth)
        .eq('year', selectedYear)

      if (attendanceError) throw attendanceError

      // 3. Fetch daily_attendance records for selected month & year where present = true
      const monthStr = String(selectedMonth).padStart(2, '0')
      const startDate = `${selectedYear}-${monthStr}-01`
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
      const endDate = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`

      const { data: dailyData, error: dailyError } = await supabase
        .from('daily_attendance')
        .select('worker_id')
        .eq('present', true)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)

      if (dailyError) throw dailyError

      // Aggregate present count per worker
      const countsMap = new Map<string, number>()
      ;(dailyData ?? []).forEach((row) => {
        const count = countsMap.get(row.worker_id) ?? 0
        countsMap.set(row.worker_id, count + 1)
      })

      setWorkers(workersData ?? [])
      setAttendances(attendanceData ?? [])
      setDailyCounts(countsMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payroll data.')
    } finally {
      setLoading(false)
    }
  }

  // Combine workers, daily attendance counts, and agreed working days into unified rows
  const payrollRows: WorkerPayrollRow[] = useMemo(() => {
    const attendanceMap = new Map<string, Attendance>()
    attendances.forEach((att) => {
      attendanceMap.set(att.worker_id, att)
    })

    return workers.map((worker) => {
      const att = attendanceMap.get(worker.id) || null
      const daysPresent = dailyCounts.get(worker.id) ?? 0
      const agreedWorkingDays = att && att.agreed_working_days > 0 ? att.agreed_working_days : null
      const remainingDays =
        agreedWorkingDays !== null ? agreedWorkingDays - daysPresent : null

      const payable =
        agreedWorkingDays !== null
          ? calculatePayable(worker.monthly_salary, agreedWorkingDays, daysPresent)
          : null

      return {
        worker,
        attendance: att,
        agreedWorkingDays,
        daysPresent,
        remainingDays,
        payable,
      }
    })
  }, [workers, attendances, dailyCounts])

  // Total payable for the month across all workers with agreed working days set
  const totalMonthlyPayout = useMemo(() => {
    return payrollRows.reduce((sum, row) => sum + (row.payable ?? 0), 0)
  }, [payrollRows])

  const calculatedCount = useMemo(() => {
    return payrollRows.filter((r) => r.payable !== null).length
  }, [payrollRows])

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Top Filter Bar: Month/Year Selectors & Summary KPI */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        {/* Month and Year Selectors */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            style={{
              padding: '9px 14px',
              border: '1px solid #E4DDD1',
              borderRadius: 2,
              fontSize: 13,
              color: '#2B2420',
              background: '#FAF7F2',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            style={{
              padding: '9px 14px',
              border: '1px solid #E4DDD1',
              borderRadius: 2,
              fontSize: 13,
              color: '#2B2420',
              background: '#FAF7F2',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={() => onRecordAttendance(undefined, selectedMonth, selectedYear)}
            style={{
              padding: '9px 16px',
              background: '#4A3728',
              border: 'none',
              borderRadius: 2,
              color: '#FAF7F2',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background 0.18s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2B2420')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#4A3728')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Set Agreed Days
          </button>
        </div>

        {/* Total Monthly Payout Card */}
        <div
          style={{
            background: '#FAF7F2',
            border: '1px solid #E4DDD1',
            padding: '10px 18px',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7259' }}>
            Total Payroll ({MONTH_NAMES[selectedMonth - 1]}):
          </span>
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 700, color: '#B8874B' }}>
            ₹{totalMonthlyPayout.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#6B7259', fontSize: 13 }}>Loading payroll data...</p>
      ) : error ? (
        <p style={{ color: '#C0523C', fontSize: 13 }}>Error: {error}</p>
      ) : workers.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: '#FAF7F2',
            border: '1px solid #E4DDD1',
          }}
        >
          <p style={{ color: '#6B7259', fontSize: 13, margin: 0 }}>
            No workers registered yet. Please add workers first in the "Manage Workers" tab.
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
                {['Worker Name', 'Monthly Base Salary', 'Days Present (Daily Log)', 'Agreed Working Days', 'Remaining Days', 'Payable Amount', 'Actions'].map((h, idx) => (
                  <th
                    key={h}
                    style={{
                      padding: '11px 16px',
                      textAlign: idx === 5 ? 'right' : idx === 6 ? 'right' : 'left',
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
              {payrollRows.map((row, i) => (
                <tr
                  key={row.worker.id}
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
                  {/* Worker Name */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#2B2420' }}>{row.worker.name}</div>
                    {row.worker.phone && (
                      <div style={{ fontSize: 11, color: '#6B7259', marginTop: 2 }}>
                        {row.worker.phone}
                      </div>
                    )}
                  </td>

                  {/* Monthly Base Salary */}
                  <td style={{ padding: '14px 16px', color: '#4A3728' }}>
                    ₹{row.worker.monthly_salary.toLocaleString('en-IN')}
                  </td>

                  {/* Days Present (from daily_attendance) */}
                  <td style={{ padding: '14px 16px', color: '#2B2420' }}>
                    <span style={{ fontWeight: 600, color: row.daysPresent > 0 ? '#4E7A58' : '#6B7259' }}>
                      {row.daysPresent} {row.daysPresent === 1 ? 'day' : 'days'}
                    </span>
                  </td>

                  {/* Agreed Working Days */}
                  <td style={{ padding: '14px 16px', color: '#6B7259' }}>
                    {row.agreedWorkingDays !== null ? (
                      `${row.agreedWorkingDays} days`
                    ) : (
                      <span style={{ color: '#C0523C', fontSize: 11, fontStyle: 'italic' }}>
                        Not set
                      </span>
                    )}
                  </td>

                  {/* Remaining Days */}
                  <td style={{ padding: '14px 16px', color: '#6B7259' }}>
                    {row.remainingDays !== null ? (
                      <span style={{ fontWeight: 600, color: row.remainingDays <= 0 ? '#4E7A58' : '#2B2420' }}>
                        {row.remainingDays} {Math.abs(row.remainingDays) === 1 ? 'day' : 'days'}
                      </span>
                    ) : (
                      <span style={{ color: '#6B7259' }}>—</span>
                    )}
                  </td>

                  {/* Calculated Payable Amount */}
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600 }}>
                    {row.payable !== null ? (
                      <span style={{ color: '#B8874B', fontSize: 14 }}>
                        ₹{row.payable.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span
                        style={{
                          background: 'rgba(192,82,60,0.08)',
                          color: '#C0523C',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: 2,
                          display: 'inline-block',
                        }}
                      >
                        Agreed days not set
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      {onOpenCalendar && (
                        <button
                          onClick={() => onOpenCalendar(row.worker)}
                          title="Open Daily Attendance Calendar"
                          style={{
                            padding: '6px 10px',
                            background: '#B8874B',
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
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#A3743C')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#B8874B')}
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
                        onClick={() =>
                          onRecordAttendance(row.worker.id, selectedMonth, selectedYear)
                        }
                        title="Set Agreed Working Days"
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
                        {row.agreedWorkingDays !== null ? 'Agreed Days' : 'Set Days'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Total Footer Row */}
            <tfoot>
              <tr
                style={{
                  background: '#FAF7F2',
                  borderTop: '2px solid #E4DDD1',
                  fontWeight: 700,
                }}
              >
                <td style={{ padding: '14px 16px', color: '#2B2420', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.08em' }}>
                  Total ({calculatedCount}/{payrollRows.length} Workers Configured)
                </td>
                <td style={{ padding: '14px 16px', color: '#6B7259' }}>—</td>
                <td style={{ padding: '14px 16px', color: '#4E7A58', fontWeight: 700 }}>
                  {payrollRows.reduce((sum, r) => sum + r.daysPresent, 0)} total days
                </td>
                <td style={{ padding: '14px 16px', color: '#6B7259' }}>—</td>
                <td style={{ padding: '14px 16px', color: '#6B7259' }}>—</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', color: '#B8874B', fontSize: 15, fontFamily: 'Fraunces, serif' }}>
                  ₹{totalMonthlyPayout.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '14px 16px' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default PayrollSummary

