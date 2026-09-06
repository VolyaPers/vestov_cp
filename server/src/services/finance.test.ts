import test from 'node:test'
import assert from 'node:assert/strict'
import { cents, money, salaryExtras, validDate, FinanceValidationError } from '../lib/money.js'
import { readPayrollData, summarizePeriod } from './payroll.js'
import { calculateInvoiceLine } from './invoiceCalculator.js'

test('strict decimal boundary preserves cents and rejects malformed, negative and excessive amounts',()=>{
  assert.equal(cents('10.05'),1005);assert.equal(money(cents('0.10')+cents('0.20')),'0.30')
  for(const value of ['1.001','-2','NaN','Infinity','1,000','1e3',Number.NaN,{},null])assert.throws(()=>cents(value),FinanceValidationError)
  assert.throws(()=>validDate('2026-02-30'));assert.equal(validDate('2028-02-29'),'2028-02-29')
})
test('structured payroll labels survive punctuation; advances and default extras settle exactly once',()=>{
  const data={version:1,salaryMonth:'2026-09',baseSalary:'1000.00',paidBase:'400.00',extras:[{label:'Health + Dental — plan: A',amount:'100.00'}],note:'Project A + project B'}
  assert.deepEqual(readPayrollData(data),data)
  const summary=summarizePeriod('1000.00',[{label:'Health + Dental — plan: A',amount:'100.00'}],[{payrollData:data}])
  assert.equal(summary.remainingBase,'600.00');assert.deepEqual(summary.remainingExtras,[]);assert.equal(summary.remainingTotal,'600.00')
  assert.equal(summarizePeriod('1000.00',[],[{payrollData:data},{payrollData:{...data,paidBase:'600.00',extras:[]}}]).remainingTotal,'0.00')
  assert.throws(()=>salaryExtras([{label:'',amount:'50'}]));assert.throws(()=>salaryExtras([{label:'Bonus',amount:'-10'}]))
})
test('legacy text cannot fabricate structured payroll fields',()=>{
  assert.equal(readPayrollData({description:'Sep 2026 — Salary Payment: $1000 of $1000'}),null)
  assert.equal(summarizePeriod('1000',[],[{payrollData:null}]).needsReview,true)
})
test('invoice fixed zero and hourly override cannot restore the stored fixed price',()=>{
  const defaults={fixedPrice:'4000',hourlyRate:'50'}
  assert.equal(calculateInvoiceLine({fixedPrice:0},defaults).amount,0)
  const hourly=calculateInvoiceLine({hourlyRate:25,hoursWorked:10},defaults)
  assert.equal(hourly.amount,25000);assert.equal(hourly.fixedPrice,null)
  assert.equal(calculateInvoiceLine({hourlyRate:'0.10',hoursWorked:'0.30'},defaults).amount,3)
  assert.throws(()=>calculateInvoiceLine({hourlyRate:25,hoursWorked:-1},defaults))
  assert.throws(()=>calculateInvoiceLine({hourlyRate:25,hoursWorked:745},defaults))
})
