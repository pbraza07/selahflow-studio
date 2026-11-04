// Focus containment for legacy modal shells. Native <dialog> keeps its own behavior.
const stacks=new WeakMap();
export function containDialogFocus(dialog,onClose){
 const doc=dialog.ownerDocument,win=doc.defaultView;
 const stack=stacks.get(doc)||[];stacks.set(doc,stack);
 const previous=doc.activeElement,overflow=doc.body.style.overflow;
 const entry={dialog};stack.push(entry);doc.body.style.overflow='hidden';
 const active=()=>stack.at(-1)===entry&&!doc.querySelector('dialog[open]');
 const controls=()=>Array.from(dialog.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')).filter(el=>!el.disabled&&el.tabIndex>=0&&!el.closest('[hidden],[inert]')&&win.getComputedStyle(el).display!=='none'&&win.getComputedStyle(el).visibility!=='hidden');
 const focus=()=>{(controls()[0]||dialog).focus({preventScroll:true});};
 const keydown=event=>{
  if(!active())return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();onClose();}
  if(event.key==='Tab'){
   const items=controls(),first=items[0],last=items.at(-1);
   if(!items.length){event.preventDefault();dialog.focus();return;}
   if(event.shiftKey&&(doc.activeElement===first||doc.activeElement===dialog||!dialog.contains(doc.activeElement))){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(doc.activeElement===last||!dialog.contains(doc.activeElement))){event.preventDefault();first.focus();}
  }
 };
 const focusin=()=>{if(active()&&!dialog.contains(doc.activeElement))focus();};
 if(active())focus();doc.addEventListener('keydown',keydown,true);doc.addEventListener('focusin',focusin);
 return()=>{
  doc.removeEventListener('keydown',keydown,true);doc.removeEventListener('focusin',focusin);
  const index=stack.indexOf(entry),top=index===stack.length-1;if(index>=0)stack.splice(index,1);
  if(top){doc.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});}
 };
}
