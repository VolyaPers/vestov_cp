import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type PayslipData = { currency: string; periods: Array<{salaryMonth:string;baseSalary:string;paidBase:string;remainingTotal:string;status:string;calculationNote?:string}>;payments:Array<{id:number;amount:string;transactionDate:string;description:string;payrollData:{version:number;salaryMonth:string;paidBase:string;extras:Array<{label:string;amount:string}>;note?:string}|null}> }
const usd=(value:string|number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value))
export function EmployeeSalary(){
  const {data,isLoading,error,refetch}=useQuery<PayslipData>({queryKey:['my-salary'],queryFn:()=>api.request('/finances/my-salary')})
  if(isLoading)return <p role="status">Loading your salary statements…</p>
  if(error)return <div role="alert"><p>{error instanceof Error?error.message:'Salary data is unavailable'}</p><Button onClick={()=>refetch()}>Retry</Button></div>
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">My Salary</h1><p className="text-sm text-muted-foreground">Monthly salary statements and recorded payments in USD. Your fixed salary is separate from attendance and leave; approved adjustments are shown in the statement.</p></div>
    {!data?.periods.length&&<Card><CardContent className="pt-6">No structured salary statements have been recorded yet. Historical payments below may require finance review.</CardContent></Card>}
    <div className="grid gap-4 md:grid-cols-2">{data?.periods.slice().sort((a,b)=>b.salaryMonth.localeCompare(a.salaryMonth)).map(period=><Card key={period.salaryMonth}><CardHeader><CardTitle>{period.salaryMonth}</CardTitle></CardHeader><CardContent className="space-y-2"><p>Base salary: <strong>{usd(period.baseSalary)}</strong></p><p>Base paid: {usd(period.paidBase)}</p><p>Remaining, including default extras: <strong>{usd(period.remainingTotal)}</strong></p><p className="text-sm">Status: {period.status.replace('_',' ')}</p>{period.calculationNote&&<p className="text-xs text-muted-foreground">{period.calculationNote}</p>}</CardContent></Card>)}</div>
    <h2 className="text-lg font-semibold">Payment History</h2>{!data?.payments.length&&<p>No payments recorded.</p>}
    {data?.payments.map(payment=><Card key={payment.id}><CardContent className="space-y-2 pt-6"><div className="flex justify-between gap-4"><strong>{payment.payrollData?.salaryMonth || 'Historical payment — review pending'}</strong><strong>{usd(payment.amount)}</strong></div><p className="text-sm">Paid on {payment.transactionDate}</p>{payment.payrollData?<><p>Base salary paid: {usd(payment.payrollData.paidBase)}</p>{payment.payrollData.extras.map((extra,index)=><p key={index}>{extra.label}: {usd(extra.amount)}</p>)}{payment.payrollData.note&&<p className="text-sm text-muted-foreground">{payment.payrollData.note}</p>}</>:<p className="text-sm text-muted-foreground">{payment.description || 'Ask finance to reconcile this payment’s salary period and breakdown.'}</p>}</CardContent></Card>)}
  </div>
}
