import Link from 'next/link';
import {APP_VERSION} from '../../lib/app-version';
import styles from '../site.module.css';
export default function PublicFooter(){return <footer className={styles.footer}><span>SelahFlow · Pause &amp; Flow · v{APP_VERSION}</span><nav aria-label="Footer"><Link href="/customers">For customers</Link><Link href="/businesses">For businesses</Link><Link href="/admin/platform">Platform administration</Link></nav></footer>;}
