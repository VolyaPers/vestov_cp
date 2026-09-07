import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'wouter'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

type Fee = {id:number;description:string;amount:string;accruedDate:string;status:string;paymentTransactionId:number|null}
type FeeData = { fees:Array<{fee:Fee;projectName:string|null;serviceName:string;clientName:string;paymentDate:string|null}>; projects:Array<{id:number;name:string|null;serviceName:string;clientName:string}>;canRecordPayment:boolean }
const usd=(value:number|string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value))
export function FreelancerFees({ memberId }: {memberId:number}) {
  const queryClient=useQueryClient(),key=['freelancerFees',memberId]
  const {data,isLoading,error,refetch}=useQuery<FeeData>({queryKey:key,queryFn:()=>api.request(`/finances/freelancer-fees/${memberId}`)})
  const [project,setProject]=useState(''),[description,setDescription]=useState(''),[amount,setAmount]=useState('')
  const [date,setDate]=useState(()=>new Date().toISOString().slice(0,10)),[requestKey,setRequestKey]=useState(()=>crypto.randomUUID())
  const [saving,setSaving]=useState(false),[failure,setFailure]=useState('')
  const [payment,setPayment]=useState<{fee:Fee;key:string;date:string}|null>(null)
  async function mutate(path:string,body:object,done:()=>void) {
    setSaving(true);setFailure('')
    try {await api.request(`/finances/freelancer-fees/${memberId}${path}`,{method:'POST',body:JSON.stringify(body)});done();await queryClient.invalidateQueries({queryKey:key})}
    catch(error){setFailure(error instanceof Error?error.message:'Unable to save project fee')}finally{setSaving(false)}
  }
  if(isLoading)return <Card><CardContent className="p-6">Loading project fees…</CardContent></Card>
  if(error)return <Card><CardContent className="p-6"><p role="alert">Unable to load project fees.</p><Button variant="outline" onClick={()=>refetch()}>Retry</Button></CardContent></Card>
  const outstanding=data.fees.filter(row=>row.fee.status==='accrued').reduce((sum,row)=>sum+Number(row.fee.amount),0)
  const paid=data.fees.filter(row=>row.fee.status==='paid').reduce((sum,row)=>sum+Number(row.fee.amount),0)
  return <Card><CardHeader><CardTitle>Project fees</CardTitle><CardDescription>Accrue any agreed project amount, then record the actual payment separately.</CardDescription></CardHeader><CardContent className="space-y-6">
    <div className="flex flex-wrap gap-8"><p className="text-sm">Outstanding <strong className="block text-xl">{usd(outstanding)}</strong></p><p className="text-sm">Paid <strong className="block text-xl">{usd(paid)}</strong></p></div>
    {data.projects.length?<form className="space-y-3" onSubmit={e=>{e.preventDefault();void mutate('',{clientServiceId:Number(project),description,amount,accruedDate:date,idempotencyKey:requestKey},()=>{setAmount('');setDescription('');setRequestKey(crypto.randomUUID())})}}>
      <div className="space-y-2"><Label htmlFor="fee-project">Project</Label><select id="fee-project" className="h-10 w-full rounded-md border bg-white px-3" required value={project} onChange={e=>setProject(e.target.value)}><option value="">Select assigned project</option>{data.projects.map(p=><option key={p.id} value={p.id}>{p.clientName} · {p.name||p.serviceName}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="fee-description">Work or milestone</Label><Input id="fee-description" required maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="fee-amount">Agreed amount (USD)</Label><Input id="fee-amount" type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></div><div className="space-y-2"><Label htmlFor="fee-date">Accrual date</Label><Input id="fee-date" type="date" required value={date} onChange={e=>setDate(e.target.value)}/></div></div>
      <Button disabled={saving} type="submit">{saving?'Saving…':'Accrue project fee'}</Button>
    </form>:<p className="text-sm text-muted-foreground">Assign this freelancer to a project in <Link href="/admin/clients" className="underline">Clients</Link> to add a fee.</p>}
    {failure&&!payment&&<p role="alert" className="text-sm text-red-600">{failure}</p>}
    <div className="space-y-3">{!data.fees.length&&<p className="text-sm text-muted-foreground">No project fees yet.</p>}{data.fees.map(row=><div key={row.fee.id} className="space-y-2 rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-2"><strong className="break-words">{row.fee.description}</strong><strong>{usd(row.fee.amount)}</strong></div><p className="text-sm text-muted-foreground">{row.clientName} · {row.projectName||row.serviceName} · {row.fee.accruedDate}</p><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{row.fee.status==='accrued'?'Outstanding':row.fee.status==='paid'?'Paid':'Cancelled'}</Badge>{row.paymentDate&&<span className="text-xs text-muted-foreground">Paid {row.paymentDate} · transaction #{row.fee.paymentTransactionId}</span>}{row.fee.status==='accrued'&&<>{data.canRecordPayment&&<Button size="sm" disabled={saving} onClick={()=>{setFailure('');setPayment({fee:row.fee,key:crypto.randomUUID(),date:new Date().toISOString().slice(0,10)})}}>Record payment</Button>}<Button size="sm" variant="outline" disabled={saving} onClick={()=>mutate(`/${row.fee.id}/cancel`,{},()=>{})}>Cancel accrual</Button></>}</div></div>)}</div>
    <Dialog open={Boolean(payment)} onOpenChange={open=>{if(!open&&!saving)setPayment(null)}}><DialogContent role="dialog" aria-modal="true" aria-labelledby="fee-payment-title"><DialogHeader><DialogTitle id="fee-payment-title">Record project payment</DialogTitle><DialogDescription>Confirm the payment already made for this fee.</DialogDescription></DialogHeader>{payment&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();void mutate(`/${payment.fee.id}/pay`,{transactionDate:payment.date,idempotencyKey:payment.key},()=>setPayment(null))}}><p>{payment.fee.description} · <strong>{usd(payment.fee.amount)}</strong></p><Label htmlFor="fee-payment-date">Payment date</Label><Input id="fee-payment-date" type="date" required min={payment.fee.accruedDate} value={payment.date} onChange={e=>setPayment({...payment,date:e.target.value})}/>{failure&&<p role="alert" className="text-sm text-red-600">{failure}</p>}<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={saving} onClick={()=>setPayment(null)}>Cancel</Button><Button disabled={saving} type="submit">{saving?'Saving…':'Confirm recorded payment'}</Button></div></form>}</DialogContent></Dialog>
  </CardContent></Card>
}
