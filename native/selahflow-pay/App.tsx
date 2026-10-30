import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Alert,Button,Linking,Platform,SafeAreaView,ScrollView,Text} from 'react-native';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import {StripeTerminalProvider,useStripeTerminal,requestNeededAndroidPermissions} from '@stripe/stripe-terminal-react-native';
const origins=new Set(['https://selahflow.onrender.com','https://selahflow-staging.onrender.com']);
type Grant={origin:string;token:string;bookingId:string};
async function request(origin:string,body:Record<string,unknown>,token?:string){
 const r=await fetch(origin+'/api/native/payments',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to contact SelahFlow.');return d;
}
export default function App(){
 const [grant,setGrant]=useState<Grant|null>(null),[message,setMessage]=useState('Open an appointment in your dashboard → Pay on Site → Open SelahFlow Pay.'),[busy,setBusy]=useState(false),authorizing=useRef(false);
 const handle=useCallback(async(raw:string|null|undefined)=>{
  if(!raw||authorizing.current)return;
  try{
   const url=new URL(raw);if(url.protocol!=='selahflowpay:'||url.hostname!=='collect')return;
   const origin=url.searchParams.get('origin')||'',bookingId=url.searchParams.get('booking')||'';
   if(!origins.has(origin)||!/^[-a-f0-9]{36}$/i.test(bookingId))throw Error('Open a valid SelahFlow appointment link.');
   if(grant){Alert.alert('Finish this appointment','Disconnect this appointment before connecting another.');return;}
   authorizing.current=true;setBusy(true);setMessage('Authorize this appointment in your owner browser.');
   const hex=(b:Uint8Array)=>Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');
   const verifier=hex(await Crypto.getRandomBytesAsync(32)),state=hex(await Crypto.getRandomBytesAsync(24));
   const digest=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,verifier,{encoding:Crypto.CryptoEncoding.BASE64}),challenge=digest.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   const result=await WebBrowser.openAuthSessionAsync(origin+'/onsite/authorize?booking='+bookingId+'&challenge='+challenge+'&state='+state,'selahflowpay://authorized');
   if(result.type!=='success')throw Error('Authorization cancelled. Reopen the appointment to try again.');
   const callback=new URL(result.url);if(callback.protocol!=='selahflowpay:'||callback.hostname!=='authorized'||callback.searchParams.get('state')!==state)throw Error('Invalid phone authorization.');
   const d=await request(origin,{action:'exchange',code:callback.searchParams.get('code'),state,verifier});if(d.bookingId!==bookingId)throw Error('Appointment mismatch.');
   setGrant({origin,token:d.token,bookingId});setMessage('');
  }catch(e){setMessage((e as Error).message);}finally{authorizing.current=false;setBusy(false);}
 },[grant]);
 const handleRef=useRef(handle);handleRef.current=handle;
 useEffect(()=>{void Linking.getInitialURL().then(url=>handleRef.current(url));const sub=Linking.addEventListener('url',e=>void handleRef.current(e.url));return()=>sub.remove();},[]);
 const tokenProvider=useCallback(async()=>{if(!grant)throw Error('Authorize an appointment first.');return (await request(grant.origin,{action:'connection-token'},grant.token)).secret;},[grant]);
 return <SafeAreaView style={{flex:1,backgroundColor:'#f4f6f4'}}>{grant?<StripeTerminalProvider tokenProvider={tokenProvider} logLevel="error" localeConfig={{type:'cardLanguagePreferenceIfAvailable'}}><Collection grant={grant} onDisconnect={()=>setGrant(null)}/></StripeTerminalProvider>:<ScrollView contentContainerStyle={{padding:24,gap:18}}><Text style={{fontSize:28,fontWeight:'700'}}>SelahFlow Pay</Text><Text accessibilityRole="alert">{message}</Text>{busy&&<Text>Waiting for owner authorization…</Text>}<Button title="Open SelahFlow" onPress={()=>void Linking.openURL('https://selahflow.onrender.com/studio/owner')}/></ScrollView>}</SafeAreaView>;
}
function Collection({grant,onDisconnect}:{grant:Grant;onDisconnect:()=>void}){
 const [info,setInfo]=useState<any>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[ready,setReady]=useState(false);
 const sdk=useStripeTerminal({onDidRequestReaderDisplayMessage:m=>setMessage(String(m)),onDidDisconnect:()=>{setReady(false);setMessage('Phone disconnected. Check payment before reconnecting.');}});
 const api=useCallback((action:string)=>request(grant.origin,{action},grant.token),[grant]);
 const check=async()=>{const d=await api('check');setMessage(d.paid?'Stripe payment verified and recorded in SelahFlow.':'Not yet verified. Status: '+d.status);if(d.paid)setInfo((old:any)=>({...old,paid:true}));return d;};
 useEffect(()=>{void api('info').then(setInfo).catch(e=>setMessage(e.message));},[api]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);try{await fn();}catch(e){setMessage((e as Error).message+' Check payment before attempting another charge.');}finally{setBusy(false);}};
 return <ScrollView contentContainerStyle={{padding:24,gap:18}}><Text style={{fontSize:28,fontWeight:'700'}}>Collect appointment payment</Text>{info&&<><Text style={{fontSize:22}}>{info.business}</Text><Text>{info.client} · {info.date}</Text><Text style={{fontSize:32,fontWeight:'700'}}>${(info.amountCents/100).toFixed(2)} USD</Text>{info.sandbox&&<Text>STRIPE SANDBOX — simulated reader. No live payment.</Text>}</>}<Text accessibilityLiveRegion="polite">{message}</Text>
 {info&&!info.paid&&<><Text>Confirm the client and amount. Collection closes any unpaid online checkout for this appointment.</Text><Button title={ready?'Phone ready':'Set up phone'} disabled={busy||ready} onPress={()=>void run(async()=>{
  if(Platform.OS==='android'){const p=await requestNeededAndroidPermissions();if(p.error)throw Error('Grant the requested permissions to accept payments.');}
  const init=await sdk.initialize();if(init.error)throw Error(init.error.message);
  if(sdk.connectedReader){const r=await sdk.disconnectReader();if(r?.error)throw Error(r.error.message);}
  const cleared=await sdk.clearCachedCredentials();if(cleared.error)throw Error(cleared.error.message);
  const r=await sdk.easyConnect({discoveryMethod:'tapToPay',locationId:info.locationId,simulated:info.sandbox,merchantDisplayName:info.business,tosAcceptancePermitted:true,autoReconnectOnUnexpectedDisconnect:true});if(r.error)throw Error(r.error.message);setReady(true);setMessage('Phone ready. Follow the Stripe prompts to collect payment.');
 })}/><Button title="Collect payment" disabled={busy||!ready} onPress={()=>void run(async()=>{
  const start=await api('start');if(start.paid){await check();return;}
  const r=await sdk.retrievePaymentIntent(start.clientSecret);if(r.error||!r.paymentIntent)throw Error(r.error?.message||'Unable to retrieve payment.');
  const processed=await sdk.processPaymentIntent({paymentIntent:r.paymentIntent,skipTipping:true}),verified=await check();if(processed.error&&!verified.paid)throw Error(processed.error.message);
 })}/><Button title="Cancel unpaid collection" disabled={busy} onPress={()=>Alert.alert('Cancel collection?','A processing or completed payment cannot be cancelled here.',[{text:'Keep',style:'cancel'},{text:'Cancel collection',onPress:()=>void run(async()=>{const d=await api('cancel');setMessage(d.paid?'Payment already verified.':'Collection status: '+d.status);if(d.paid)setInfo((old:any)=>({...old,paid:true}));})}])}/></>}
 <Button title="Check payment" disabled={busy} onPress={()=>void run(async()=>{await check();})}/><Button title="Back to appointment" disabled={busy} onPress={()=>void Linking.openURL(grant.origin+'/studio/owner')}/><Button title="Disconnect appointment" disabled={busy} onPress={()=>void run(async()=>{if(sdk.connectedReader){const d=await sdk.disconnectReader();if(d?.error)throw Error(d.error.message);}await api('disconnect');onDisconnect();})}/><Text>No card details are stored in SelahFlow. A signed app and Stripe/Apple phone activation are required.</Text></ScrollView>;
}
