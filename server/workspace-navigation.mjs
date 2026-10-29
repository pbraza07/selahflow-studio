// Shared presentation metadata. Permissions remain enforced by the existing APIs.
export const workspaceGroups = [
 {title:'Daily work',items:['Overview','Calendar','Clients']},
 {title:'Sales & memberships',items:['Memberships','Checkout','Reports']},
 {title:'Business setup',items:['Services','Branding','Settings','Receptionist']},
 {title:'History & account',items:['Guide','History','Security']}
];
/** @type {Record<string,string>} */
export const workspaceLabels={Overview:'Dashboard',Calendar:'Schedule',Clients:'Clients',Services:'Services & pricing',Memberships:'Memberships',Checkout:'Sales & payments',Reports:'Financial reports',History:'Activity history',Receptionist:'Client assistant',Branding:'Website & branding',Settings:'Business settings',Guide:'Owner guide',Security:'Account security'};
/** @type {Record<string,string>} */
export const workspaceDescriptions = {
 Overview:'Bookings, requests and daily activity in one place.',
 Calendar:'Manage sessions, availability and attendance.',
 Clients:'Find customer details, memberships and visit history.',
 History:'Review and filter your business activity.',
 Services:'Review your service catalog and prices. Use Edit services to update them in Business settings.',
 Memberships:'Manage plans, registrations and membership sessions.',
 Checkout:'Record a cash payment or settle an eligible booking. Manage online payment setup in Business settings.',
 Reports:'Review paid revenue and amounts awaiting approval or payment.',
 Receptionist:'Help clients find published service information, booking guidance and status checks.',
 Branding:'Edit your client website, page wording, logo, social links, colors and fonts.',
 Settings:'Set up business details, service catalog, booking rules, scheduled sessions, payments and team.',
 Guide:'Step-by-step business owner PDF guide, setup and daily how-tos.',
 Security:'Manage your account password.'
};
export function filteredWorkspaceGroups(query='') {
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return workspaceGroups.map(group=>({...group,items:group.items.filter(item=>terms.every(term=>(item+' '+workspaceLabels[item]+' '+workspaceDescriptions[item]).toLowerCase().includes(term)))})).filter(group=>group.items.length);
}
export function hasUnsavedWorkspaceChanges(view,config,savedConfig) {
 return (view==='Settings'||view==='Branding')&&JSON.stringify(config)!==savedConfig;
}
