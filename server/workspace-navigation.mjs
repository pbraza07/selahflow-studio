// Shared presentation metadata. Permissions remain enforced by the existing APIs.
export const workspaceGroups = [
 {title:'Daily work',items:['Overview','Calendar','Clients']},
 {title:'Sales & records',items:['Services','Memberships','Checkout','Reports','History']},
 {title:'Your business',items:['Receptionist','Branding','Settings','Security']}
];
/** @type {Record<string,string>} */
export const workspaceDescriptions = {
 Overview:'Appointments, requests and daily activity in one place.',
 Calendar:'Manage sessions, availability and attendance.',
 Clients:'Find customer details, memberships and visit history.',
 History:'Review and filter your business activity.',
 Services:'Browse the services offered by your business.',
 Memberships:'Manage plans, registrations and membership sessions.',
 Checkout:'Record a sale or settle an eligible booking.',
 Reports:'Review paid revenue and amounts awaiting approval or payment.',
 Receptionist:'Manage booking guidance and approved business answers.',
 Branding:'Edit public pages, wording, logo, social links, colors, fonts and booking QR sharing.',
 Settings:'Update business details, booking rules, sessions and team.',
 Security:'Manage your account password.'
};
export function filteredWorkspaceGroups(query='') {
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return workspaceGroups.map(group=>({...group,items:group.items.filter(item=>terms.every(term=>(item+' '+workspaceDescriptions[item]).toLowerCase().includes(term)))})).filter(group=>group.items.length);
}
export function hasUnsavedWorkspaceChanges(view,config,savedConfig) {
 return (view==='Settings'||view==='Branding')&&JSON.stringify(config)!==savedConfig;
}
