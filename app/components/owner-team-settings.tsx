'use client';
import {useState} from 'react';
import OwnerTeamAccess from './owner-team-access';
import OwnerTeamServicePercentages from './owner-team-service-percentages';

const sections=[
 {id:'access',title:'Logins & workspace fees',description:'Set up access, session permissions and recurring workspace pricing.'},
 {id:'rates',title:'Service percentages',description:'Choose the owner’s share for each member and service.'},
 {id:'ledger',title:'Transactions & balances',description:'Review service earnings, outstanding amounts and payments received.'},
] as const;

export default function OwnerTeamSettings(){
 const [section,setSection]=useState<(typeof sections)[number]['id']>('access');
 return <section className="sf-team-settings" data-sf-settings-group="team-access" aria-label="Team access and earnings">
  <nav className="sf-team-settings-nav" aria-label="Team settings sections">
   {sections.map((item,index)=><button type="button" key={item.id} aria-pressed={section===item.id} aria-controls="team-settings-content" onClick={()=>setSection(item.id)}><span className="sf-team-settings-step" aria-hidden="true">{index+1}</span><span><b>{item.title}</b><small>{item.description}</small></span></button>)}
  </nav>
  <div id="team-settings-content">
   {section==='access'?<OwnerTeamAccess/>:<OwnerTeamServicePercentages key={section} view={section}/>}
  </div>
 </section>;
}
