export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.SELAHFLOW_MESSAGE_WORKER==='true'&&process.env.DATABASE_URL){
  const {startClientMessageWorker}=await import('./server/booking-client-notifications.mjs');
  startClientMessageWorker();
  const {startDiscoveryLocationWorker}=await import('./server/discovery-locations.mjs');
  startDiscoveryLocationWorker();
  const {startTeamBookingPushWorker}=await import('./server/team-booking-push.mjs');
  startTeamBookingPushWorker();
 }
}
