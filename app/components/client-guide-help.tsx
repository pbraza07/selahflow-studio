import {publicClientGuide} from '../../server/client-guides.mjs';
import styles from './business-assistant.module.css';
export default function ClientGuideHelp({slug}:{slug:string}){
 const guide=publicClientGuide(slug);if(!guide)return null;
 return <a className={styles.guideHelp} href={guide.href} target="_blank" rel="noopener noreferrer" aria-label={'Request help: open '+guide.title+' in a new tab'}><strong>Request help</strong><small>Step-by-step client guide (PDF)</small></a>;
}
