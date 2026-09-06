/** Invoices become overdue after the whole due date, never during that date. */
export function invoiceDaysOverdue(dueDate:string|Date|null|undefined,now=new Date()):number {
  if(!dueDate)return 0
  const date=typeof dueDate==='string'?dueDate.slice(0,10):dueDate.toISOString().slice(0,10)
  const today=now.toISOString().slice(0,10)
  const days=(Date.parse(`${today}T00:00:00Z`)-Date.parse(`${date}T00:00:00Z`))/86400000
  return Number.isFinite(days)?Math.max(0,days):0
}
