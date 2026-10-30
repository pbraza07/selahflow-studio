'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import styles from '../site.module.css';
export default function BusinessCarousel({children,count,title='Find your next favorite business',description='Swipe or use the arrows to explore.',label='Browse businesses',itemLabel='businesses',singularLabel='Business',trackId='discover-business-track'}:{children:ReactNode;count:number;title?:string;description?:string;label?:string;itemLabel?:string;singularLabel?:string;trackId?:string}){
 const track=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState({index:0,start:true,end:count<2});
 useEffect(()=>{
  const el=track.current;if(!el)return;
  const update=()=>{
   const cards=Array.from(el.children) as HTMLElement[];
   const origin=cards[0]?.offsetLeft||0;
   const distances=cards.map(card=>Math.abs(card.offsetLeft-origin-el.scrollLeft));
   const index=distances.length?distances.indexOf(Math.min(...distances)):0;
   const next={index,start:el.scrollLeft<=2,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-2};
   setPosition(old=>old.index===next.index&&old.start===next.start&&old.end===next.end?old:next);
  };
  el.scrollTo({left:0,behavior:'instant'});update();
  el.addEventListener('scroll',update,{passive:true});
  const observer=new ResizeObserver(update);observer.observe(el);
  return()=>{el.removeEventListener('scroll',update);observer.disconnect();};
 },[count]);
 function move(direction:number){
  const el=track.current;if(!el)return;
  const cards=Array.from(el.children) as HTMLElement[];
  const origin=cards[0]?.offsetLeft||0;
  const offsets=cards.map(card=>card.offsetLeft-origin);
  // Select the next card from the current position, including partially visible cards.
  const target=direction>0?offsets.find(offset=>offset>el.scrollLeft+2):offsets.filter(offset=>offset<el.scrollLeft-2).at(-1);
  el.scrollTo({left:target??(direction>0?el.scrollWidth:0),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 return <section className={styles.businessCarousel} aria-label={label} aria-roledescription="carousel">
  <div className={styles.carouselHeading}><div><h2>{title}</h2><p>{description}</p></div><div className={styles.carouselControls}>
   <button type="button" aria-label={'Previous '+itemLabel} aria-controls={trackId} disabled={position.start} onClick={()=>move(-1)}><ArrowLeft size={20}/></button>
   <button type="button" aria-label={'Next '+itemLabel} aria-controls={trackId} disabled={position.end} onClick={()=>move(1)}><ArrowRight size={20}/></button>
  </div></div>
  <div id={trackId} ref={track} className={styles.carouselTrack} tabIndex={0} aria-label={singularLabel+' cards; use left and right arrow keys to browse'} onKeyDown={e=>{
   if(e.target!==e.currentTarget||!['ArrowLeft','ArrowRight'].includes(e.key))return;
   e.preventDefault();move(e.key==='ArrowRight'?1:-1);
  }}>{children}</div>
  <p className={styles.carouselPosition} aria-live="polite">{singularLabel} {position.index+1} of {count}</p>
 </section>;
}
