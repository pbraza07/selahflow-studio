export default function ServiceBookingActions({price,options,disabled,busy,confirmLabel}:{price:number;options:{online:boolean;onsite:boolean};disabled:boolean;busy:boolean;confirmLabel:string}){
 if(price<=0)return <button className="primary" form="public-confirm" type="submit" value="business" disabled={disabled}>{busy?'Booking…':confirmLabel}</button>;
 return <>{options.onsite&&<button className="outline" form="public-confirm" type="submit" value="business" disabled={disabled}>{busy?'Booking…':'Pay onsite'}</button>}{options.online&&<button className="primary" form="public-confirm" type="submit" value="online" disabled={disabled}>{busy?'Booking…':'Make payment'}</button>}</>;
}
