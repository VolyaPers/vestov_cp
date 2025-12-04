export interface VacationBalance {
    totalAllocated: number;
    totalUsed: number;
    totalRemaining: number;
    firstHalfAvailable: number;
    firstHalfUsed: number;
    firstHalfRemaining: number;
    secondHalfAvailable: number;
    secondHalfUsed: number;
    secondHalfRemaining: number;
    currentlyAvailable: number;
    lockedUntilSecondHalf: number;
    cashableAtYearEnd: number;
    willExpire: number;
    isFirstHalf: boolean;
    daysUntilSecondHalf: number;
    cycleStartDate: string;
    cycleMidpointDate: string;
    cycleEndDate: string;
    cycleId: number;
    cycleNumber: number;
    baseAllocation: number;
}
export declare function calculateVacationBalance(employeeId: number, currentDate?: Date): Promise<VacationBalance | null>;
/**
 * Validate if a vacation request can be approved based on 50/50 rule
 */
export declare function validateVacationRequest(employeeId: number, requestStartDate: Date, requestDays: number, currentDate?: Date): Promise<{
    allowed: boolean;
    reason?: string;
}>;
