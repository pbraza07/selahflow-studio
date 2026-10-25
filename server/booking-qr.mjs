import QRCode from 'qrcode';
import {bookingShareUrl} from './booking-share-url.mjs';
export async function bookingQr({slug,origin,format='svg'}){
 if(!['svg','png'].includes(format))throw Error('Choose SVG or PNG.');const url=bookingShareUrl(slug,origin),options={errorCorrectionLevel:/** @type {'Q'} */('Q'),margin:4,width:1024,color:{dark:'#000000ff',light:'#ffffffff'}};
 return {url,type:format==='png'?'image/png':'image/svg+xml',body:format==='png'?await QRCode.toBuffer(url,{...options,type:'png'}):await QRCode.toString(url,{...options,type:'svg'})};
}
