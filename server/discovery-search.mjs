export const searchText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function addressCity(address){
 const parts=String(address||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(parts.length<2)return '';
 if(/^(usa|united states(?: of america)?)$/i.test(parts.at(-1)))parts.pop();
 if(/^(?:[A-Z]{2}|[A-Za-z ]+)\s+\d{5}(?:-\d{4})?$/.test(parts.at(-1)||'')||/^[A-Z]{2}$/.test(parts.at(-1)||''))parts.pop();
 if(/^(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia)$/i.test(parts.at(-1)||''))parts.pop();
 return parts.length>=2&&!/\d/.test(parts.at(-1))?parts.at(-1):'';
}
export function discoveryBusiness(row){
 const {studio_data,logo_version,google_address,google_city,google_region,...business}=row;
 let config={};try{config=JSON.parse(studio_data||'{}');}catch{}
 const legacyAddress=/^\d+\s/.test(String(row.city||''))?String(row.city).trim():'';
 const ownerAddress=(typeof config.address==='string'&&!/^Add your /i.test(config.address)?config.address.trim():'')||legacyAddress;
 const ownerCity=legacyAddress?addressCity(legacyAddress):row.city||'';
 const city=google_city||ownerCity||addressCity(ownerAddress)||'';
 return {...business,description:String(row.description||'').trim(),city,region:google_region||row.region||'',address:google_address||ownerAddress,hasLogo:Boolean(logo_version),logoVersion:logo_version?new Date(logo_version).toISOString():null,
  // Internal matching fields are stripped by the route before returning the result.
  _cities:[google_city&&[google_city,google_region].filter(Boolean).join(' '),addressCity(ownerAddress)&&[addressCity(ownerAddress),row.region].filter(Boolean).join(' '),ownerCity&&[ownerCity,row.region].filter(Boolean).join(' ')].filter(Boolean)};
}
export function matchesDiscovery(business,{q='',city='',industry=''}){
 const contains=(haystack,needle)=>{const terms=searchText(needle);if(String(needle).trim()&&!terms)return String(haystack).includes(String(needle).trim());return terms.split(' ').filter(Boolean).every(word=>searchText(haystack).includes(word));};
 return (!industry||business.industry===industry)&&contains(business.name+' '+business.description,q)&&(!city||(business._cities||[business.city]).some(value=>contains(value,city)));
}

// Use the unfiltered public marketplace rows, before search and result limits.
export const marketplaceIndustries=rows=>[...new Set(rows.map(row=>typeof row.industry==='string'?row.industry.trim():'').filter(Boolean))].sort();
