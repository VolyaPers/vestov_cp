import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { getDatePreset, getPresetLabel, type DatePreset } from '@/lib/datePresets'
import { InvoiceList } from './InvoiceList'

const currency = (amount:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(amount)
const sum = (rows:any[]) => rows.reduce((total,row)=>total+Math.round(Number(row.amount)*100),0)/100

export function InvoiceStatsChart({clientId}:{clientId:number}) {
  const [startDate,setStartDate] = useState('')
  const [endDate,setEndDate] = useState('')
  const {data:invoices=[],error,isLoading,refetch} = useQuery({queryKey:['invoices','client',clientId],queryFn:()=>api.getClientInvoices(clientId)})
  const filtered = useMemo(()=>invoices.filter(invoice=>{
    const date=invoice.invoiceDate.slice(0,10)
    return (!startDate || date>=startDate)&&(!endDate || date<=endDate)
  }),[invoices,startDate,endDate])
  const valid=filtered.filter(invoice=>invoice.status!=='cancelled')
  const outstanding=valid.filter(invoice=>['sent','overdue'].includes(invoice.status))
  const overdue=outstanding.filter(invoice=>invoice.status==='overdue')
  // The invoiced period is invoiceDate; cash receipts have their own paidAt period.
  const receipts=invoices.filter(invoice=>invoice.status==='paid'&&invoice.paidAt&&(!startDate || invoice.paidAt.slice(0,10)>=startDate)&&(!endDate || invoice.paidAt.slice(0,10)<=endDate))
  const monthly=useMemo(()=>{
    const amounts=new Map<string,number>()
    for(const invoice of receipts){const month=invoice.paidAt!.slice(0,7);amounts.set(month,(amounts.get(month)||0)+Math.round(Number(invoice.amount)*100))}
    return [...amounts].sort(([a],[b])=>a.localeCompare(b)).map(([month,amount])=>({month,paid:amount/100}))
  },[receipts])
  const pie=[
    {name:'Paid',value:sum(valid.filter(invoice=>invoice.status==='paid')),color:'#10b981'},
    {name:'Outstanding, not overdue',value:sum(outstanding.filter(invoice=>invoice.status!=='overdue')),color:'#f59e0b'},
    {name:'Overdue',value:sum(overdue),color:'#ef4444'},
    {name:'Draft',value:sum(valid.filter(invoice=>invoice.status==='draft')),color:'#94a3b8'},
  ].filter(item=>item.value>0)
  const preset=(value:DatePreset)=>{const range=getDatePreset(value);setStartDate(range.startDate);setEndDate(range.endDate)}
  return <Tabs defaultValue="statistics" className="w-full">
    <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="statistics">Statistics</TabsTrigger><TabsTrigger value="invoices">All Invoices ({invoices.length})</TabsTrigger></TabsList>
    <TabsContent value="statistics" className="space-y-4 mt-4">
      <Card><CardHeader><CardTitle>Invoice Statistics</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">{(['thisMonth','lastMonth','thisYear'] as DatePreset[]).map(value=><Button key={value} variant="outline" size="sm" onClick={()=>preset(value)}>{getPresetLabel(value)}</Button>)}<Button variant="ghost" size="sm" onClick={()=>{setStartDate('');setEndDate('')}}>All time</Button></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="invoice-stat-start">From</Label><Input id="invoice-stat-start" type="date" value={startDate} onChange={event=>setStartDate(event.target.value)}/></div><div><Label htmlFor="invoice-stat-end">Through</Label><Input id="invoice-stat-end" type="date" value={endDate} onChange={event=>setEndDate(event.target.value)}/></div></div>
        {error ? <div role="alert">Unable to load invoice statistics. <Button onClick={()=>refetch()}>Retry</Button></div> : isLoading ? <p>Loading invoices…</p> : <>
          {startDate&&endDate&&startDate>endDate&&<p role="alert" className="text-red-600">Start date must be before end date.</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Total invoiced',sum(valid)],['Cash received',sum(receipts)],['Outstanding',sum(outstanding)],['Overdue',sum(overdue)]].map(([title,amount])=><div key={String(title)} className="rounded-lg border p-4"><p className="text-sm text-gray-600">{title}</p><p className="text-2xl font-semibold">{currency(Number(amount))}</p></div>)}</div>
          <p className="text-sm text-gray-600">Invoice balances use the invoice date. Cash received uses the payment date. Cancelled invoices are excluded; draft invoices do not create an outstanding payment.</p>
          <div className="grid gap-6 lg:grid-cols-2"><div><h3 className="font-medium mb-3">Monthly cash received</h3>{monthly.length?<ResponsiveContainer width="100%" height={280}><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis/><Tooltip formatter={(value)=>currency(Number(value))}/><Bar dataKey="paid" fill="#10b981"/></BarChart></ResponsiveContainer>:<p className="py-12 text-center text-gray-500">No recorded payments in this period.</p>}</div><div><h3 className="font-medium mb-3">Invoice balances</h3>{pie.length?<ResponsiveContainer width="100%" height={280}><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={95}>{pie.map(item=><Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip formatter={(value)=>currency(Number(value))}/></PieChart></ResponsiveContainer>:<p className="py-12 text-center text-gray-500">No invoice balances in this period.</p>}</div></div>
        </>}
      </CardContent></Card>
    </TabsContent>
    <TabsContent value="invoices" className="mt-4"><InvoiceList clientId={clientId} clientName="this client"/></TabsContent>
  </Tabs>
}
