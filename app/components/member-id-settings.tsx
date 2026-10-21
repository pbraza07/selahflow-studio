'use client';
import {useState} from 'react';
import MembershipModal from './membership-modal';
export default function MemberIdSettings(_props:{policy:string;onSaved:()=>void}){
 const [open,setOpen]=useState(false);
 return <><button className="outline" type="button" onClick={()=>setOpen(true)}>Membership ID settings</button>{open&&<MembershipModal title="Membership ID settings" busy={false} onClose={()=>setOpen(false)}>
 <p>New clients receive an eight-character Unique ID: first initial + last initial + birth month, day and two-digit year.</p>
 <p>Example: Caleb Alves, August 14, 2013 → CA081413.</p>
 <p>First name, last name and date of birth are required. If the generated ID is already assigned to another client in this business, registration stops for review. Another business may use the same ID.</p>
 <p>Existing clients keep their IDs. Permanent client deletion releases the ID for a new registration by the same or another client. Saved waivers and financial history never transfer to a new client.</p>
 </MembershipModal>}</>;
}
