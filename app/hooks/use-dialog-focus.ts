'use client';
import {useEffect,useRef} from 'react';
import {containDialogFocus} from '../../server/dialog-focus.mjs';
export default function useDialogFocus(id:string|null,onClose:()=>void){
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{if(!id)return;const dialog=document.getElementById(id);if(dialog)return containDialogFocus(dialog,()=>close.current());},[id]);
}
