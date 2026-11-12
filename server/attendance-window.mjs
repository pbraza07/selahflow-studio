/** Elapsed hours from the business-local appointment start, including DST changes. */
export const ATTENDANCE_WINDOW_HOURS=24;
export const ATTENDANCE_WINDOW_MS=ATTENDANCE_WINDOW_HOURS*60*60*1000;
export function checkInWindow(startsAt,now=new Date()){
 const start=new Date(startsAt).getTime(),at=new Date(now).getTime();
 if(!Number.isFinite(start)||!Number.isFinite(at))return 'closed';
 if(at<start-ATTENDANCE_WINDOW_MS)return 'early';
 return at<start+ATTENDANCE_WINDOW_MS?'open':'closed';
}
