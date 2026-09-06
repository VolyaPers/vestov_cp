import test from 'node:test'
import assert from 'node:assert/strict'
import { invoiceAmount, sumInvoiceAmounts, previousReportPeriod } from '../src/lib/reportCalculations.js'
test('report adapters sum decimal strings and choose equal non-overlapping periods',()=>{
  assert.equal(sumInvoiceAmounts([{amount:'100.25'},{amount:'200.75'}]),301)
  assert.equal(invoiceAmount({amount:'10.25',total:0}),0)
  assert.throws(()=>invoiceAmount({amount:'not-money'}))
  const range=previousReportPeriod('2026-09-01','2026-09-30')
  assert.equal(range.start.toISOString().slice(0,10),'2026-08-02');assert.equal(range.end.toISOString().slice(0,10),'2026-08-31')
})

import { invoiceDaysOverdue } from '../src/lib/invoiceDates.js'
test('invoice due dates remain current for the full date',()=>{assert.equal(invoiceDaysOverdue('2026-09-06',new Date('2026-09-06T23:59:59Z')),0);assert.equal(invoiceDaysOverdue('2026-09-06',new Date('2026-09-07T00:00:00Z')),1);assert.equal(invoiceDaysOverdue('2026-09-08',new Date('2026-09-07T12:00:00Z')),0)})

import {getDatePreset} from '../src/lib/datePresets.js'
test('month presets keep local calendar boundaries in Kyiv',()=>{const before=process.env.TZ;process.env.TZ='Europe/Kyiv';try{const today=new Date(),range=getDatePreset('thisMonth');assert.equal(range.startDate,`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`);assert.equal(range.endDate.slice(-2),String(new Date(today.getFullYear(),today.getMonth()+1,0).getDate()))}finally{process.env.TZ=before}})
