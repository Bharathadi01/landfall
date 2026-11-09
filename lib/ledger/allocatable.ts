/**
 * DETERMINISTIC ALLOCATABLE CASH CALCULATION (§3, §4)
 * Pure mathematical calculation — ZERO external dependencies or database imports.
 * Safe for both client and server consumption.
 */

export function calculateAllocatable({
  paypalAvailableCents,
  reserveProtectedCents,
  feesReservedCents,
  committedCents,
  isTranche1 = false,
  allowReserveDrawdown = false,
}: {
  paypalAvailableCents: number;
  reserveProtectedCents: number;
  feesReservedCents: number;
  committedCents: number;
  isTranche1?: boolean;
  allowReserveDrawdown?: boolean;
}): number {
  // Financial Invariant: Reserve is strictly protected in ALL tranches unless explicit fiduciary override is granted
  const shouldDeductReserve = !allowReserveDrawdown;
  const protectedDeduction = shouldDeductReserve ? reserveProtectedCents : 0;
  const allocatable = paypalAvailableCents - protectedDeduction - feesReservedCents - committedCents;
  return Math.max(0, allocatable);
}

