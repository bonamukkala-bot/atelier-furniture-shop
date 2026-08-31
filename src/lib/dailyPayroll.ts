import { supabase } from './supabaseClient'
import { calculatePayable } from './payroll'

/**
 * Returns array of day numbers (1-31) marked present for a worker in a given month/year.
 *
 * @param workerId ID of the worker
 * @param month 1-indexed month (1 = Jan, 12 = Dec)
 * @param year Full year (e.g. 2026)
 */
export async function getPresentDays(
  workerId: string,
  month: number,
  year: number
): Promise<number[]> {
  const monthStr = String(month).padStart(2, '0')
  const startDate = `${year}-${monthStr}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('daily_attendance')
    .select('attendance_date')
    .eq('worker_id', workerId)
    .eq('present', true)
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate)

  if (error) {
    throw error
  }

  if (!data) return []

  const days = data.map((row) => {
    const parts = row.attendance_date.split('-')
    return parseInt(parts[2], 10)
  })

  return days.sort((a, b) => a - b)
}

/**
 * Toggles a single day's attendance (present/absent) - upserts into daily_attendance.
 *
 * @param workerId ID of the worker
 * @param date Date string in 'YYYY-MM-DD' format
 * @param present Boolean indicating attendance status
 */
export async function toggleDayAttendance(
  workerId: string,
  date: string,
  present: boolean
): Promise<void> {
  const { error } = await supabase
    .from('daily_attendance')
    .upsert(
      {
        worker_id: workerId,
        attendance_date: date,
        present,
      },
      { onConflict: 'worker_id,attendance_date' }
    )

  if (error) {
    throw error
  }
}

/**
 * Calculates live payable amount for a worker in a given month, based on count of present days
 * in daily_attendance and the agreed_working_days stored in the 'attendance' table for that worker/month/year.
 * (if no agreed_working_days record exists yet for that month, treat payable as not-yet-calculable and return null instead of guessing)
 *
 * @param workerId ID of the worker
 * @param monthlySalary Worker's monthly salary
 * @param month 1-indexed month (1 = Jan, 12 = Dec)
 * @param year Full year (e.g. 2026)
 */
export async function calculateLivePayable(
  workerId: string,
  monthlySalary: number,
  month: number,
  year: number
): Promise<number | null> {
  // 1. Fetch count of present days for the month
  const presentDays = await getPresentDays(workerId, month, year)
  const count = presentDays.length

  // 2. Fetch agreed_working_days from monthly attendance table
  const { data: attRecord, error } = await supabase
    .from('attendance')
    .select('agreed_working_days')
    .eq('worker_id', workerId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (error) {
    throw error
  }

  // If no record exists or agreed_working_days is null/undefined/<=0, return null
  if (!attRecord || attRecord.agreed_working_days == null || attRecord.agreed_working_days <= 0) {
    return null
  }

  return calculatePayable(monthlySalary, attRecord.agreed_working_days, count)
}
