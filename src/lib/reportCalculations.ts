export function invoiceAmount(value: {total?: number|string;amount?: number|string}): number {
  const amount=Number(value.total ?? value.amount ?? 0)
  if(!Number.isFinite(amount)||amount<0)throw new Error('Invalid invoice amount in report data')
  return Math.round(amount*100)/100
}
export function sumInvoiceAmounts(values:Array<{total?:number|string;amount?:number|string}>):number {
  return values.reduce((sum,value)=>sum+Math.round(invoiceAmount(value)*100),0)/100
}
export function previousReportPeriod(start:string,end:string){
  const first=new Date(`${start}T00:00:00Z`),last=new Date(`${end}T00:00:00Z`)
  const length=last.getTime()-first.getTime()+86400000
  if(!Number.isFinite(length)||length<=0)throw new Error('Invalid reporting period')
  return {start:new Date(first.getTime()-length),end:new Date(first.getTime()-86400000)}
}
