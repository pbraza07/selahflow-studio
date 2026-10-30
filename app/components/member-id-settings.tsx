'use client';
import {useState} from 'react';
import MembershipModal from './membership-modal';
export default function MemberIdSettings(_props:{policy:string;onSaved:()=>void}){
 const [open,setOpen]=useState(false);
 return <><button className="outline" type="button" onClick={()=>setOpen(true)}>Client ID settings</button>{open&&<MembershipModal title="Client ID settings" busy={false} onClose={()=>setOpen(false)}>
 <p>With a birth date, new client IDs use first initial + last initial + birth month, day and two-digit year. Without a birth date, IDs use both initials + the next four-digit number, starting at 1001 for this business.</p>
 <p>Example: Alex Brown, March 15, 2013 → AB031513.</p>
 <p>First and last name are needed. Without a birth date: Alex Brown → AB1001, then Chris Davis → CD1002. The sequence belongs to this business and is shared across all initials. If the generated ID is already assigned to another client in this business, registration stops for review. Another business may use the same ID.</p>
 <p>Existing clients keep their IDs. Sequence numbers keep increasing and are not reused after deletion. Existing birth-date ID deletion rules remain. Saved waivers and financial history never transfer to a new client.</p>
 </MembershipModal>}</>;
}
