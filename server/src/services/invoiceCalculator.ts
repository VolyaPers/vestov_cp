import { and, eq, lte, or, isNull, gte } from 'drizzle-orm'
import { clientServices, serviceTypes, clientServiceTeamMembers, teamMembers } from '../db/schema.js'
import { cents, money, positiveId, validDate, FinanceValidationError } from '../lib/money.js'

export function calculateInvoiceLine(rate: any, defaults: { hourlyRate?: any; fixedPrice?: any }) {
  const selected = rate || {}
  const hourly = selected.hourlyRate !== undefined || selected.hoursWorked !== undefined
  if (selected.fixedPrice !== undefined && !hourly) return { amount: cents(selected.fixedPrice,'Fixed price'), fixedPrice:money(cents(selected.fixedPrice)), hourlyRate:null, hoursWorked:null }
  if (hourly) {
    const rateCents=cents(selected.hourlyRate ?? defaults.hourlyRate ?? '0','Hourly rate')
    const hundredthHours=cents(selected.hoursWorked ?? '0','Hours')
    if(hundredthHours>74400) throw new FinanceValidationError('Hours per invoice line cannot exceed 744')
    const amount=Math.round(rateCents*hundredthHours/100)
    if(!Number.isSafeInteger(amount)) throw new FinanceValidationError('Invoice line amount is too large')
    return {amount,hourlyRate:money(rateCents),hoursWorked:money(hundredthHours),fixedPrice:null}
  }
  if(defaults.fixedPrice!==null && defaults.fixedPrice!==undefined) return {amount:cents(defaults.fixedPrice),fixedPrice:money(cents(defaults.fixedPrice)),hourlyRate:null,hoursWorked:null}
  return {amount:0,hourlyRate:money(cents(defaults.hourlyRate ?? '0')),hoursWorked:'0.00',fixedPrice:null}
}
export async function calculateInvoice(tx:any, clientId:number, input:any) {
  const start=validDate(input.periodStart,'Period start'),end=validDate(input.periodEnd,'Period end')
  if(start>end) throw new FinanceValidationError('Invoice period start must not be after period end')
  if(!Array.isArray(input.serviceIds)||!input.serviceIds.length) throw new FinanceValidationError('Select at least one service')
  const ids=input.serviceIds.map((id:any)=>positiveId(id,'Service ID'))
  if(new Set(ids).size!==ids.length) throw new FinanceValidationError('Services may only appear once')
  const rates=input.developerRates || {}, prices=input.servicePrices || {}, services=[]
  const usedKeys=new Set<string>()
  for(const id of ids){
    const [service]=await tx.select({id:clientServices.id,serviceName:serviceTypes.name,serviceTitle:clientServices.serviceTitle,serviceLevelPrice:clientServices.serviceLevelPrice}).from(clientServices).leftJoin(serviceTypes,eq(clientServices.serviceTypeId,serviceTypes.id)).where(and(eq(clientServices.id,id),eq(clientServices.clientId,clientId)))
    if(!service) throw new FinanceValidationError('Selected service does not belong to this client')
    const assigned=await tx.select({id:clientServiceTeamMembers.id,teamMemberId:clientServiceTeamMembers.teamMemberId,name:teamMembers.name,hourlyRate:clientServiceTeamMembers.hourlyRate,fixedPrice:clientServiceTeamMembers.fixedPrice}).from(clientServiceTeamMembers).leftJoin(teamMembers,eq(clientServiceTeamMembers.teamMemberId,teamMembers.id)).where(and(eq(clientServiceTeamMembers.clientServiceId,id),lte(clientServiceTeamMembers.startDate,end),or(isNull(clientServiceTeamMembers.endDate),gte(clientServiceTeamMembers.endDate,start))))
    const developers=[]
    for(const dev of assigned){
      // Assignment IDs are canonical. No ambiguous fallback to a team member ID.
      if(!Object.prototype.hasOwnProperty.call(rates,String(dev.id))) continue
      usedKeys.add(String(dev.id))
      const line=calculateInvoiceLine(rates[dev.id],dev)
      developers.push({...dev,...line,amount:Number(money(line.amount))})
    }
    const developerCents=developers.reduce((sum,d)=>sum+cents(d.amount),0)
    const override=Object.prototype.hasOwnProperty.call(prices,String(id))?prices[id]:service.serviceLevelPrice
    const finalCents=override!==null&&override!==undefined?cents(override,'Service price'):developerCents
    services.push({serviceId:id,serviceName:service.serviceTitle||service.serviceName,serviceTypeName:service.serviceName,serviceTitle:service.serviceTitle,serviceLevelPrice:override==null?undefined:Number(money(cents(override))),developerTotal:Number(money(developerCents)),finalAmount:Number(money(finalCents)),developers})
  }
  for(const key of Object.keys(rates)) if(!usedKeys.has(key)) throw new FinanceValidationError('An invoice employee is not assigned to a selected service during this period. Refresh assignments and retry.')
  return {totalAmount:Number(money(services.reduce((sum,s)=>sum+cents(s.finalAmount),0))),services}
}
