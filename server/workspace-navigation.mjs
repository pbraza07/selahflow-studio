// Shared presentation metadata. Permissions remain enforced by the existing APIs.
export const workspaceGroups = [
 {title:'Daily work',items:['Overview','Calendar','Clients']},
 {title:'Business',items:['Memberships','Services','Checkout','Reports']},
 {title:'Manage',items:['Team','Branding','Settings']}
];
/** @type {Record<string,string>} */
export const workspaceLabels={Sessions:'Bookable sessions',Team:'Team',Payments:'Payment setup',Overview:'Dashboard',Calendar:'Schedule',Clients:'Clients',Services:'Services',Memberships:'Memberships & Packages',Checkout:'Sales & Payments',Reports:'Reports',History:'Activity log',Receptionist:'Client assistant',Branding:'Website',Settings:'Settings',Guide:'Help',Security:'Account security'};
/** @type {Record<string,string>} */
export const workspaceDescriptions = {
 Sessions:'Create and manage one-time or recurring sessions, times and capacity.',
 Team:'Manage team profiles, logins, workspace fees and availability.',
 Payments:'Connect payment providers and review payment setup.',
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
 const normalize=value=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 return workspaceGroups.map(group=>({...group,items:group.items.filter(item=>terms.every(term=>normalize(item+' '+workspaceLabels[item]+' '+workspaceDescriptions[item]+' '+(workspaceSearchTerms[item]||'')).includes(term)))})).filter(group=>group.items.length);
}
export function hasUnsavedWorkspaceChanges(view,config,savedConfig) {
 return (view==='Settings'||view==='Branding')&&JSON.stringify(config)!==savedConfig;
}

// Aliases open existing settings panels; authorization and saved data stay unchanged.
/** @type {Record<string,{view:string,area:string}>} */
export const workspaceDestinations={Sessions:{view:'Calendar',area:'sessions'},Team:{view:'Settings',area:'team'},Payments:{view:'Checkout',area:'payments'}};
export function activeWorkspaceSection(view,area){
 return view==='Settings'?(area==='sessions'?'Sessions':area==='team'||area==='team-access'?'Team':area==='payments'?'Payments':'Settings'):view;
}
/** @type {Record<string,string>} */
const workspaceSearchTerms={Overview:'inicio painel resumen',Calendar:'agenda calendario reservas agendamentos bookings',Sessions:'sesiones sessoes horarios',Clients:'clientes customers',Team:'equipo equipe funcionarios empleados',Memberships:'membresias assinaturas pacotes paquetes',Checkout:'pagos pagamentos ventas vendas',Reports:'informes relatorios receitas ingresos',Payments:'pagos pagamentos Stripe Helcim',Settings:'ajustes configuracoes configuracion',Branding:'marca site sitio',History:'historial historico',Security:'seguridad seguranca senha contrasena',Guide:'guia ayuda ajuda',Receptionist:'asistente assistente'};
