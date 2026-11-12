// Shared country choices and server normalization for pickup and billing addresses.
const codes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const names=new Intl.DisplayNames(['en'],{type:'region'});
export const PRODUCT_COUNTRIES=codes.map(code=>[code,names.of(code)||code]).sort((a,b)=>a[1].localeCompare(b[1]));
export const PRODUCT_US_STATES=[
 ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],['DC','District of Columbia']
].concat([['PR','Puerto Rico'],['VI','U.S. Virgin Islands'],['GU','Guam'],['AS','American Samoa'],['MP','Northern Mariana Islands']]);
const normalize=value=>String(value||'').trim().toLowerCase().replace(/[.]/g,'').replace(/\s+/g,' ');
export function productCountry(value){
 const key=normalize(value),aliases={'usa':'US','united states of america':'US','uk':'GB','brasil':'BR'};
 return aliases[key]||PRODUCT_COUNTRIES.find(([code,label])=>normalize(code)===key||normalize(label)===key)?.[0]||'';
}
export function productState(value,country){
 const key=normalize(value);
 if(country==='US')return PRODUCT_US_STATES.find(([code,label])=>normalize(code)===key||normalize(label)===key)?.[0]||'';
 return String(value||'').trim().toUpperCase();
}
