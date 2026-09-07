import test from 'node:test'
import assert from 'node:assert/strict'
import { employmentType, benefitFactor, payableExtras, reimbursementPolicy } from './employmentPolicy.js'
import { summarizeLeave } from '../utils/vacationBalanceCalculator.js'

test('employment policy halves benefits but never a contracted salary; cents round once',()=>{
  assert.equal(employmentType(), 'fulltime')
  for(const value of ['contractor',null,'',12])assert.throws(()=>employmentType(value))
  assert.equal(benefitFactor('freelancer'),0)
  assert.deepEqual(payableExtras([{label:'Bonus',amount:'100.01'}],'part_time'),[{label:'Bonus',amount:'50.01'}])
  assert.deepEqual(payableExtras([{label:'Bonus',amount:'100.01'}],'fulltime'),[{label:'Bonus',amount:'100.01'}])
  assert.deepEqual(payableExtras([{label:'Receipt',amount:'25',reimbursementId:1}],'part_time'),[{label:'Receipt',amount:'25.00',reimbursementId:1}])
  assert.deepEqual(reimbursementPolicy(1,'part_time'),{yearlyLimit:150,reimbursementRate:.25})
  assert.deepEqual(reimbursementPolicy(5,'fulltime'),{yearlyLimit:700,reimbursementRate:.5})
})
test('part-time leave scales new and saved allocations once, preserves used days and halves cashout cap',()=>{
  const vacation={id:1,name:'Vacation'},sick={id:2,name:'Sick Leave'},personal={id:3,name:'Personal Leave'}
  const context:any={member:{startDate:'2025-01-01',employmentType:'part_time'},cycles:[{id:1,cycleStart:'2026-01-01'}],balances:[{employmentCycleId:1,leaveTypeId:1,totalDays:'20',adjustmentDays:'2'}],settings:[],types:[vacation,sick,personal],requests:[{id:1,leaveTypeId:1,status:'approved',startDate:'2026-02-02',endDate:'2026-02-03'}]}
  const summary=summarizeLeave(context,vacation,'2026-03-01')
  assert.equal(summary.totalAllocated,11);assert.equal(summary.totalUsed,2);assert.equal(summary.totalRemaining,9)
  assert.equal(summary.firstHalfAvailable,5.5);assert.equal(summary.cashableAtYearEnd,2.5)
  assert.equal(summarizeLeave(context,sick,'2026-03-01').totalAllocated,3.5)
  assert.equal(summarizeLeave(context,personal,'2026-03-01').totalAllocated,2.5)
  context.member.employmentType='fulltime';assert.equal(summarizeLeave(context,vacation,'2026-03-01').totalAllocated,22)
  context.member.employmentType='freelancer';assert.equal(summarizeLeave(context,vacation,'2026-03-01').totalAllocated,0)
})
