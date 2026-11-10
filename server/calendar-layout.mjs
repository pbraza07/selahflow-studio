// Lay out every event, including short cards whose visible height exceeds their
// duration. Half-open intervals let touching appointments reuse a column.
export const CALENDAR_PIXELS_PER_MINUTE = 100 / 60;
export const CALENDAR_MIN_EVENT_HEIGHT = 100;
export const CALENDAR_LANE_WIDTH = 188;

export function layoutCalendarEvents(events = []) {
 const sorted = events.map(event => {
  const start = Number(event.start), duration = Number(event.duration);
  const height = Math.max(CALENDAR_MIN_EVENT_HEIGHT, Math.max(1, duration) * CALENDAR_PIXELS_PER_MINUTE - 4);
  return {...event, start, duration, height, visualEnd: start + height / CALENDAR_PIXELS_PER_MINUTE};
 }).filter(event => Number.isFinite(event.start) && Number.isFinite(event.duration))
  .sort((a,b) => a.start-b.start || b.visualEnd-a.visualEnd || String(a.key).localeCompare(String(b.key)));
 const result = [];
 let cluster = [], laneEnds = [], clusterEnd = -Infinity;
 function finish() {
  for (const event of cluster) result.push({...event, lanes:laneEnds.length});
  cluster = []; laneEnds = []; clusterEnd = -Infinity;
 }
 for (const event of sorted) {
  if (event.start >= clusterEnd) finish();
  let lane = laneEnds.findIndex(end => end <= event.start);
  if (lane < 0) lane = laneEnds.length;
  laneEnds[lane] = event.visualEnd;
  cluster.push({...event, lane});
  clusterEnd = Math.max(clusterEnd, event.visualEnd);
 }
 finish();
 return result;
}

export function calendarTimeRange(open, close, events = []) {
 const starts = events.map(e=>Number(e.start)).filter(Number.isFinite);
 const ends = events.map(e=>Number(e.start)+Number(e.duration)).filter(Number.isFinite);
 const start = Math.max(0, Math.floor(Math.min((Number.isFinite(Number(open))?Number(open)*60:540), ...starts)/60)*60);
 const end = Math.min(1440, Math.ceil(Math.max((Number.isFinite(Number(close))?Number(close)*60:1080), start+60, ...ends)/60)*60);
 return {start,end};
}
