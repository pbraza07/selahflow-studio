import {supportActor,supportSelection} from '../../../server/platform-support.mjs';
import {cookies} from 'next/headers';
import type {Metadata} from 'next';
import {businessDeviceName} from '../../../server/business-device-name.mjs';
import {redirect} from 'next/navigation';
import {getPool} from '../../../server/database.mjs';
import {tokenHash} from '../../../server/security.mjs';
import OwnerDashboard from '../owner-dashboard';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{0,100}$/.test(slug))return {};
 try{
  const row=(await getPool().query("SELECT name FROM businesses WHERE slug=$1 AND status='active'",[slug])).rows[0];
  if(!row)return {};
  const label=businessDeviceName(row.name);
  return {title:label,manifest:'/api/business/manifest?slug='+encodeURIComponent(slug),
   appleWebApp:{capable:true,statusBarStyle:'default',title:label}};
 }catch{return {};}
}

export default async function StudioDashboard({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const token=(await cookies()).get('salonflow_session')?.value;
 if(!token||!/^[a-f0-9]{64}$/.test(token))redirect('/login');
 let actor,support;
 try{const req=new Request('https://selahflow.invalid/studio/'+encodeURIComponent(slug),{headers:{cookie:'salonflow_session='+token}});actor=await supportActor(getPool(),req);}catch(e){if((e as Error).message==='PASSWORD_CHANGE_REQUIRED')redirect('/account/require-password-change');redirect('/login');}
 try{support=await supportSelection(getPool(),actor);}catch{redirect('/admin/platform');}
 if(support){if(support.slug!==slug)redirect('/studio/'+encodeURIComponent(support.slug));return <OwnerDashboard businessSlug={support.slug} isPlatformAdmin supportBusinessName={support.name}/>;}
 const result=await getPool().query("SELECT b.slug, u.must_change_password, EXISTS(SELECT 1 FROM platform_admins p JOIN users u ON u.id=p.user_id WHERE p.user_id=s.user_id AND (p.role='admin' OR (p.role='primary' AND u.email='pbraza@gmail.com'))) AS is_platform_admin FROM sessions s JOIN businesses b ON b.owner_id=s.user_id JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND b.status='active' LIMIT 1",[tokenHash(token)]);
 const actualSlug=result.rows[0]?.slug as string|undefined;
 if(!actualSlug){const result=await getPool().query('SELECT b.status FROM businesses b JOIN sessions s ON s.user_id=b.owner_id WHERE s.token_hash=$1 AND s.expires_at>now() LIMIT 1',[tokenHash(token)]);if(result.rows[0]?.status)redirect('/registration-status');redirect('/login');}
 if(result.rows[0]?.must_change_password===true)redirect('/account/require-password-change');
 if(actualSlug!==slug)redirect('/studio/'+encodeURIComponent(actualSlug));
 return <OwnerDashboard businessSlug={actualSlug} isPlatformAdmin={result.rows[0].is_platform_admin===true}/>;
}
