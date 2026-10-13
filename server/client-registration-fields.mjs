/**
 * Keep registration display data independent from the owner's current form
 * configuration. Original labels saved at submission take priority.
 */
export function registrationAnswerRows(answers, originalLabels={}, fields=[]){
 const values=answers&&typeof answers==='object'&&!Array.isArray(answers)?answers:{};
 const labels=originalLabels&&typeof originalLabels==='object'&&!Array.isArray(originalLabels)?originalLabels:{};
 const current=Array.isArray(fields)?fields:[];
 return Object.entries(values).filter(([,value])=>value!==undefined&&value!==null).map(([id,value])=>{
  const field=current.find(f=>f&&f.id===id);
  const savedLabel=typeof labels[id]==='string'&&labels[id].trim()?labels[id].trim():null;
  return {id,label:savedLabel||field?.label||id,value:typeof value==='boolean'?value:String(value),type:field?.type||(typeof value==='boolean'?'checkbox':'text')};
 });
}
export function dateOnly(value){
 if(typeof value==='string')return value.slice(0,10);
 if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);
 return '';
}
export function displayAnswer(value){
 if(value===true)return 'Yes';
 if(value===false)return 'No';
 if(value===null||value===undefined||String(value).trim()==='')return 'Not provided';
 return String(value);
}
