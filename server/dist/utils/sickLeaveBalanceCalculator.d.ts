export interface SickLeaveBalance {
    totalAllocated: number;
    totalUsed: number;
    totalRemaining: number;
    cycleStartDate: string;
    cycleEndDate: string;
    cycleId: number;
}
/**
 * Calculate sick leave balance for an employee
 *
 * Rules:
 * 1. Default allocation: 7 days per employment cycle
 * 2. No 50/50 split - all days available throughout the entire cycle
 * 3. Can be used in any half of the year
 * 4. Unused sick days do NOT roll over to next cycle
 * 5. Unused sick days are NOT cashable
 */
export declare function calculateSickLeaveBalance(employeeId: number, currentDate?: Date): Promise<SickLeaveBalance | null>;
