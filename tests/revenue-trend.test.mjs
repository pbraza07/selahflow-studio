import test from 'node:test';
import assert from 'node:assert/strict';
import {revenueTrend} from '../server/revenue-trend.mjs';
test('daily, Sunday-week and month trends use Eastern payment dates, include empty intervals and stop at the report date',()=>{
 const payments=[{created:'2027-01-01T04:59:00Z',total:12.34},{created:'2027-01-01T05:00:00Z',total:0.66},{created:'2027-01-03',total:8},{created:'2027-01-05',total:99}];
 for(const [interval,count,expected] of [['Daily',30,0],['Weekly',12,800],['Monthly',12,866]]){
  const rows=revenueTrend(payments,'2027-01-04',interval);
  assert.equal(rows.length,count);assert.equal(rows.at(-1).cents,expected);assert.equal(rows.reduce((s,r)=>s+r.cents,0),2100);
 }
});
