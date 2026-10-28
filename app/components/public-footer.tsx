import Link from 'next/link';
import {APP_VERSION} from '../../lib/app-version';
import styles from '../site.module.css';
export default function PublicFooter(){return <footer className={styles.footer}><span className="sf-footer-identity"><Link href="/" aria-label="SelahFlow home"><img src="/brand/logo.svg?v=1.3.99" alt="SelahFlow — Your bookings flow. You breathe." width="170" height="46"/></Link><small>v{APP_VERSION}</small></span><nav aria-label="Footer"><Link href="/discover">Find a business</Link><Link href="/customers#visit-help">Client help</Link><Link href="/businesses">For business owners</Link><Link href="/privacy">Privacy Policy</Link><Link href="/admin/platform">Platform administration</Link></nav></footer>;}
