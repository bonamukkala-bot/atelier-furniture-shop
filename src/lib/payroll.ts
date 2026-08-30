/**
 * Calculates a worker's payable amount for a given month based on attendance.
 *
 * Formula:
 * payable = monthly_salary - ((agreed_working_days - days_present) * (monthly_salary / agreed_working_days))
 *
 * Examples:
 * - 25 agreed, 25 present, ₹20,000 salary => ₹20,000 - ((25 - 25) * 800) = ₹20,000
 * - 25 agreed, 20 present, ₹20,000 salary => ₹20,000 - ((25 - 20) * 800) = ₹16,000
 * - 25 agreed, 0 present,  ₹20,000 salary => ₹20,000 - ((25 - 0) * 800)  = ₹0
 * - 25 agreed, 27 present, ₹20,000 salary => ₹20,000 - ((25 - 27) * 800) = ₹21,600
 *
 * @param monthlySalary The worker's standard full monthly salary
 * @param agreedWorkingDays Total expected working days for that month (must be > 0)
 * @param daysPresent Total number of days the worker was present
 * @returns Payable salary rounded to 2 decimal places
 */
export function calculatePayable(
  monthlySalary: number,
  agreedWorkingDays: number,
  daysPresent: number
): number {
  if (agreedWorkingDays <= 0) return 0
  const payable = monthlySalary - ((agreedWorkingDays - daysPresent) * (monthlySalary / agreedWorkingDays))
  return Math.round(payable * 100) / 100 // round to 2 decimals
}
