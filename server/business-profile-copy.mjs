// Compare display text without changing the business's saved wording.
const text=value=>typeof value==='string'?value.trim():'';
const key=value=>value.normalize('NFKC').replace(/\s+/gu,' ').toLowerCase();
export function businessIntroLines({tagline,business_model,description}={}){
 const lines=[text(tagline),text(business_model)||text(description)].filter(Boolean);
 const seen=new Set();
 const unique=lines.filter(line=>{const id=key(line);if(seen.has(id))return false;seen.add(id);return true;});
 return unique.length?unique:['Appointments made simple. Discover services and book a time that works for you.'];
}
