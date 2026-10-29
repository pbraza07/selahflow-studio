const workerKey=Symbol.for('selahflow.discovery-location-worker');
export function googleLocation(place){
 const component=type=>String((place.addressComponents||[]).find(c=>c.types?.includes(type))?.longText||'').slice(0,80);
 return {address:String(place.formattedAddress||'').slice(0,400),city:component('locality')||component('postal_town')||component('administrative_area_level_3'),region:component('administrative_area_level_1')};
}
export async function refreshDiscoveryLocations(db,env=process.env,fetcher=fetch){
 const key=env.GOOGLE_MAPS_API_KEY||env.GOOGLE_PLACES_API_KEY;
 // Expired Google-derived address data is removed; owner-entered data is untouched.
 await db.query("DELETE FROM business_discovery_locations WHERE fetched_at<now()-interval '30 days' OR NOT EXISTS(SELECT 1 FROM business_google_profiles g WHERE g.business_id=business_discovery_locations.business_id AND g.place_id=business_discovery_locations.place_id)");
 if(!key)return {updated:0};
 const rows=(await db.query("SELECT g.business_id,g.place_id FROM business_google_profiles g JOIN businesses b ON b.id=g.business_id LEFT JOIN business_discovery_locations d ON d.business_id=g.business_id WHERE b.status='active' AND g.place_id<>'' AND (d.business_id IS NULL OR d.place_id<>g.place_id OR d.attempted_at<now()-interval '24 hours') ORDER BY d.attempted_at NULLS FIRST LIMIT 50")).rows;
 let updated=0;
 for(const row of rows){
  // Mark the attempt before a provider call to avoid repeated failed requests.
  await db.query("INSERT INTO business_discovery_locations(business_id,place_id) VALUES($1,$2) ON CONFLICT(business_id) DO UPDATE SET place_id=EXCLUDED.place_id,address=CASE WHEN business_discovery_locations.place_id=EXCLUDED.place_id THEN business_discovery_locations.address ELSE '' END,city=CASE WHEN business_discovery_locations.place_id=EXCLUDED.place_id THEN business_discovery_locations.city ELSE '' END,region=CASE WHEN business_discovery_locations.place_id=EXCLUDED.place_id THEN business_discovery_locations.region ELSE '' END,fetched_at=CASE WHEN business_discovery_locations.place_id=EXCLUDED.place_id THEN business_discovery_locations.fetched_at ELSE NULL END,attempted_at=now()",[row.business_id,row.place_id]);
  try{
   const response=await fetcher('https://places.googleapis.com/v1/places/'+encodeURIComponent(row.place_id),{headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':'id,formattedAddress,addressComponents'},cache:'no-store',signal:AbortSignal.timeout(8000)});
   if(!response.ok){console.warn('Discovery Google location lookup unavailable; using owner-provided data. Status:',response.status);continue;}const place=await response.json();if(place.id!==row.place_id)continue;
   const value=googleLocation(place);
   await db.query("UPDATE business_discovery_locations SET place_id=$2,address=$3,city=$4,region=$5,fetched_at=now(),attempted_at=now() WHERE business_id=$1 AND EXISTS(SELECT 1 FROM business_google_profiles g WHERE g.business_id=$1 AND g.place_id=$2)",[row.business_id,row.place_id,value.address,value.city,value.region]);updated++;
  }catch{/* A provider outage never hides a business's owner-provided location. */}
 }
 return {updated};
}
export function startDiscoveryLocationWorker(){
 if(globalThis[workerKey])return;
 if(!process.env.GOOGLE_MAPS_API_KEY&&!process.env.GOOGLE_PLACES_API_KEY)console.info('Discovery Google location sync has no server-side Places key; saved business locations remain available.');
 const tick=async()=>{const {getPool}=await import('./database.mjs');const db=await getPool().connect();try{const lock=(await db.query('SELECT pg_try_advisory_lock(81371750) AS acquired')).rows[0]?.acquired;if(!lock)return;try{const result=await refreshDiscoveryLocations(db);if(result.updated)console.info('Discovery Google locations refreshed:',result.updated);}finally{await db.query('SELECT pg_advisory_unlock(81371750)');}}catch{console.warn('Discovery location refresh deferred; owner locations remain available.');}finally{db.release();}};
 const run=()=>void tick().catch(()=>console.warn('Discovery location refresh deferred.'));
 globalThis[workerKey]=setInterval(run,300000);globalThis[workerKey].unref?.();setTimeout(run,1000).unref?.();
}
