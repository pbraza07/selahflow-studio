'use client';
import {useEffect,useState} from 'react';
import {bookingShareUrl} from '../../server/booking-share-url.mjs';
export default function BookingPageSharing({slug,name}:{slug:string;name:string}){
 const [url,setUrl]=useState(''),[status,setStatus]=useState(''),[imageError,setImageError]=useState(false),[qrFile,setQrFile]=useState<File|null>(null);
 useEffect(()=>{setUrl(bookingShareUrl(slug,window.location.origin));setQrFile(null);const controller=new AbortController();
  void fetch('/api/studio/booking-qr?format=png',{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('QR unavailable');const blob=await response.blob();if(!controller.signal.aborted)setQrFile(new File([blob],slug+'-booking-qr.png',{type:'image/png'}));}).catch(()=>{});
  return()=>controller.abort();
 },[slug]);
 async function copy(){try{await navigator.clipboard.writeText(url);setStatus('Booking link copied.');}catch{setStatus('Copy the booking link from the field below.');}}
 async function share(){try{if(navigator.share)await navigator.share({title:name+' bookings',text:'Book a session with '+name,url});else await copy();}catch(e){if((e as Error).name!=='AbortError')await copy();}}
 async function shareQr(){
  if(!navigator.share||!navigator.canShare){setStatus('Download the PNG below, then share the saved QR image from your device.');return;}
  if(!qrFile){setStatus('The QR image is preparing. You can also download it below.');return;}
  try{const file=qrFile;
   if(navigator.canShare({files:[file]}))await navigator.share({title:name+' booking QR',text:'Scan to book with '+name,files:[file]});else setStatus('Download the PNG below, then share the saved QR image from your device.');
  }catch(e){if((e as Error).name!=='AbortError')setStatus('Image sharing is unavailable. Download the PNG below to share it.');}
 }
 return <section className="panel padded sf-branding-share"><h2>Booking QR &amp; sharing</h2><p>Share your booking page in messages, on social media, or on a printed sign. Scanning this QR opens your booking page without a client login.</p>
 <div className="sf-booking-qr">{imageError?<p role="alert">QR preview unavailable. Reload Branding or try the download links.</p>:<img src="/api/studio/booking-qr?format=svg" width={256} height={256} alt={'Booking QR code for '+name} onError={()=>setImageError(true)}/>}</div>
 <label>Booking page link<input readOnly value={url} onFocus={e=>e.target.select()} aria-label="Booking page link"/></label>
 <div className="sf-branding-actions"><button type="button" className="primary" disabled={!url} onClick={share}>Share booking page</button><button type="button" className="outline" disabled={!url||!qrFile} onClick={shareQr}>Share QR image</button><button type="button" className="outline" disabled={!url} onClick={copy}>Copy booking link</button><a className="outline" href="/api/studio/booking-qr?format=png&download=1" download>Download QR · PNG</a><a className="outline" href="/api/studio/booking-qr?format=svg&download=1" download>Download QR · SVG</a>{url&&<a className="outline" href={url} target="_blank" rel="noopener noreferrer">Open booking page</a>}</div>
 <p className="muted">PNG is ready for sharing; SVG stays sharp when printed. The QR contains only your public booking link. It is generated within SelahFlow, without an external QR service.</p>{status&&<p role="status">{status}</p>}</section>;
}
