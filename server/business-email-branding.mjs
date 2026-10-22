import sharp from 'sharp';
import {resolveTheme} from './themes.mjs';

/** Read current branding by canonical, server-derived business identity only.
 * No destination/name matching, remote images or cross-business cache.
 */
export async function loadBusinessEmailBrand(db,{businessId,ownerId}={}){
 if(!businessId&&!ownerId)return null;
 const row=(await db.query(`SELECT b.id,b.name,b.brand_primary,b.brand_background,s.data AS settings,l.mime_type,l.bytes
 FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id LEFT JOIN business_logos l ON l.business_id=b.id
 WHERE b.status='active' AND ($1::text IS NULL OR b.id=$1) AND ($2::text IS NULL OR b.owner_id=$2) LIMIT 1`,[businessId||null,ownerId||null])).rows[0];
 if(!row)throw Error('Email business branding unavailable.');
 let config={};try{config=typeof row.settings==='string'?JSON.parse(row.settings):row.settings||{};}catch{}
 const brand={businessId:row.id,name:String(row.name||'Business').slice(0,150),colors:resolveTheme(config.theme,row.brand_primary,row.brand_background).colors,logo:null};
 if(row.bytes&&['image/png','image/jpeg','image/webp'].includes(row.mime_type)){
  const bytes=Buffer.from(row.bytes);
  if(bytes.length&&bytes.length<=300*1024)try{
   // Inline PNG works without public URLs and covers uploaded WebP logos too.
   brand.logo=await sharp(bytes,{limitInputPixels:16000000,animated:false}).rotate().resize({width:600,height:300,fit:'inside',withoutEnlargement:true}).png().toBuffer();
  }catch{/* A damaged legacy upload must not block a payment or booking email. */}
 }
 return brand;
}
