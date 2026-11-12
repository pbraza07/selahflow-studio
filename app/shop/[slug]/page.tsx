import {notFound} from 'next/navigation';
import {getPool} from '../../../server/database.mjs';
import ProductShop from '../../components/product-shop';
import styles from '../../components/product-catalog.module.css';
import {themeStyles} from '../../../server/themes.mjs';
import type {CSSProperties} from 'react';
export const dynamic='force-dynamic';
export default async function ShopPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))notFound();const b=(await getPool().query("SELECT b.name,b.brand_primary,b.brand_background,s.data FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.slug=$1 AND b.status='active'",[slug])).rows[0];if(!b)notFound();let config:any={};try{config=JSON.parse(b.data||'{}')}catch{}return <main className={styles.page} style={themeStyles(config.theme,b.brand_primary,b.brand_background) as CSSProperties} data-selah-theme="true"><a href={'/'+slug}>← {b.name}</a><ProductShop slug={slug}/></main>;}
