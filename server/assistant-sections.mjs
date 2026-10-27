/** Group only the already projected public documents; never include raw settings. */
export function groupAssistantDocuments(documents){
 const labels={guide:'Client instructions',overview:'Business overview',contact:'Location and contact',hours:'Opening hours',service:'Services and prices',membership:'Membership plans', 'membership-rules':'Membership rules', 'membership-wording':'Membership information',policy:'Policies',payment:'Booking and payment',wording:'Booking information',team:'Public team',question:'Registration questions',waiver:'Waiver and consent',session:'Upcoming sessions'};
 const groups=new Map();
 for(const d of documents){
  const title=labels[d.kind]||'Business information';
  if(!groups.has(title))groups.set(title,{title,items:[]});
  groups.get(title).items.push({title:d.title,text:d.text,href:d.href});
 }
 return [...groups.values()];
}
