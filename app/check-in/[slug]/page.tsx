import {notFound} from 'next/navigation';
import {getPool} from '../../../server/database.mjs';
import {kioskObject} from '../../../server/kiosk.mjs';
import TabletCheckIn from '../../components/tablet-check-in';
export const dynamic='force-dynamic';
export const metadata={title:'Welcome · Client check-in',robots:{index:false,follow:false}};
export default async function CheckInPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))notFound();
 const db=getPool(),b=(await db.query("SELECT b.id,b.name,b.slug,b.brand_primary,b.brand_background,s.data FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.slug=$1 AND b.status='active'",[slug])).rows[0];
 if(!b)notFound();const config=kioskObject(b.data);
 return <TabletCheckIn business={{slug:b.slug,name:b.name,theme:config.theme,primary:b.brand_primary,background:b.brand_background}}/>;
}
