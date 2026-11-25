import {financialDate} from './financial-pipeline.mjs';

export const trendWindows = {Daily:30, Weekly:12, Monthly:12};

function startOfPeriod(day, interval) {
 const date = new Date(day+'T00:00:00Z');
 if (interval==='Monthly') date.setUTCDate(1);
 if (interval==='Weekly') date.setUTCDate(date.getUTCDate()-date.getUTCDay());
 return date;
}

export function revenueTrend(payments, through, interval) {
 const start = startOfPeriod(through,interval);
 const count = trendWindows[interval];
 const periods = new Map();
 for (let offset=count-1; offset>=0; offset--) {
  const date = new Date(start);
  if (interval==='Monthly') date.setUTCMonth(date.getUTCMonth()-offset);
  else date.setUTCDate(date.getUTCDate()-offset*(interval==='Weekly'?7:1));
  const day=date.toISOString().slice(0,10);
  periods.set(day,{day,cents:0,payments:0});
 }
 for (const payment of payments) {
  const day=financialDate(payment.created);
  if (!day || day>through) continue;
  const bucket=periods.get(startOfPeriod(day,interval).toISOString().slice(0,10));
  const cents=Math.round(Number(payment.total)*100);
  if (bucket && Number.isSafeInteger(cents)) {
   bucket.cents+=cents;
   bucket.payments++;
  }
 }
 return [...periods.values()];
}
