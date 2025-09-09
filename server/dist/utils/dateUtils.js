export function calculateDays(startDate, endDate, halfDayStart = false, halfDayEnd = false) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Calculate the difference in days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    let adjustedDays = diffDays;
    if (halfDayStart)
        adjustedDays -= 0.5;
    if (halfDayEnd)
        adjustedDays -= 0.5;
    return Math.max(0, adjustedDays);
}
export function isToday(date) {
    const today = new Date();
    const checkDate = new Date(date);
    return today.toDateString() === checkDate.toDateString();
}
export function isThisWeek(date) {
    const today = new Date();
    const checkDate = new Date(date);
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    return checkDate >= startOfWeek && checkDate <= endOfWeek;
}
