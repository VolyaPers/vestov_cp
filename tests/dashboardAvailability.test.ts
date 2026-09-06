import test from 'node:test'
import assert from 'node:assert/strict'
import {dashboardCashPosition,dashboardSourceState} from '../src/lib/dashboardAvailability.js'

test('dashboard distinguishes absent, stale and confirmed empty sources',()=>{
  assert.deepEqual(dashboardSourceState(undefined,new Error('offline')),{usable:false,fresh:false})
  assert.deepEqual(dashboardSourceState({shifts:[]},undefined),{usable:true,fresh:true})
  assert.deepEqual(dashboardSourceState({shifts:[{id:1}]},new Error('refresh failed')),{usable:true,fresh:false})
})
test('unknown bank cash is not zero and cannot produce a false zero-month runway',()=>{
  assert.equal(dashboardCashPosition(undefined).amount,null)
  assert.equal(dashboardCashPosition({stripe:null,payoneer:null}).amount,null)
  const connected={stripe:{available:0,currency:'USD'},payoneer:null}
  assert.equal(dashboardCashPosition(connected).amount,0)
  assert.equal(dashboardCashPosition(connected,new Error('offline')).amount,null)
  assert.equal(dashboardCashPosition({...connected,errors:['Payoneer unavailable']}).amount,null)
  assert.equal(dashboardCashPosition({...connected,payoneer:{available:100,currency:'EUR'}}).amount,null)
  assert.equal(dashboardCashPosition({stripe:{available:100.25,currency:'USD'},payoneer:{available:200.75,currency:'USD'}}).amount,301)
})
