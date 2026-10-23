import styles from './business-assistant.module.css';
export type AnswerSection={title:string;items:{title:string;text:string;href?:string}[]};
/** Native disclosure controls remain keyboard accessible and start collapsed. */
export default function AssistantAnswer({sections}:{sections:AnswerSection[]}){
 return <div className={styles.sections}>{sections.map((section,index)=><section key={index} aria-label={section.title}>
  <h3>{section.title}</h3>
  {section.items.map((item,n)=><details key={n} className={styles.subsection}>
   <summary>{item.title}</summary>
   <div className={styles.sectionBody}><div className={styles.text}>{item.text}</div>{item.href&&<a href={item.href}>View published source</a>}</div>
  </details>)}
 </section>)}</div>;
}
