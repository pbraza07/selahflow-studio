import BusinessCarousel from './business-carousel';
import styles from './team-showcase.module.css';
type Member={id:string;publicSlug?:string;name:string;description:string;portraitId:string};
export default function TeamShowcase({members}:{members:Member[]}){
 if(!members.length)return null;
 return <section className={styles.showcase} aria-label="Meet the team"><BusinessCarousel count={members.length} title="Meet the team" description="Get to know the people behind your next visit. Swipe to explore." label="Browse team members" itemLabel="team members" singularLabel="Team member" trackId="business-team-track">{members.map(member=><article className={styles.card} key={member.id}><a href={'/team/'+encodeURIComponent(member.publicSlug||member.id)} className={styles.portraitLink} aria-label={'View '+member.name+'’s profile and booking calendar'}><img src={'/api/team/media?id='+encodeURIComponent(member.portraitId)} alt={member.name} loading="lazy" width={480} height={480}/></a><div className={styles.copy}><h3><a href={'/team/'+encodeURIComponent(member.publicSlug||member.id)}>{member.name}</a></h3>{member.description&&<p className={styles.bio}>{member.description}</p>}<a className={styles.link} href={'/team/'+encodeURIComponent(member.publicSlug||member.id)}>View profile &amp; book <span aria-hidden="true">↗</span></a></div></article>)}</BusinessCarousel></section>;
}
