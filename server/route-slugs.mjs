const RESERVED_SLUGS=new Set(['crawford','studio','book','login','logout','signup','register','admin','api','business','discover','customers','businesses','pricing','health','favicon','_next','public','settings','terms','privacy','support','contact','about','features','dashboard','team','registration-status']);
export function isReservedBusinessSlug(slug){return typeof slug==='string'&&RESERVED_SLUGS.has(slug.toLowerCase());}
export function dashboardPath(slug){if(typeof slug!=='string'||!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))throw new Error('Invalid business slug');return '/studio/'+slug;}
export function businessPath(slug){if(typeof slug!=='string'||!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))throw new Error('Invalid business slug');return '/'+slug;}
export function bookingPath(slug){if(typeof slug!=='string'||!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))throw new Error('Invalid business slug');return '/book/'+slug;}
