"use client";
import {useCallback,useEffect,useReducer,useRef,type Dispatch,type SetStateAction} from 'react';
import {changeHistory,type History,type HistoryAction} from './design-history';
export function useDesignHistory<T>(initial:T){
 const [state,dispatch]=useReducer((s:History<T>,a:HistoryAction<T>)=>changeHistory(s,a),{present:initial,past:[],future:[],group:null});
 const serial=useRef(0),gesture=useRef<number|null>(null);
 const set:Dispatch<SetStateAction<T>>=useCallback(value=>dispatch({type:'set',value,group:gesture.current??++serial.current}),[]);
 const undo=useCallback(()=>dispatch({type:'undo'}),[]),redo=useCallback(()=>dispatch({type:'redo'}),[]);
 useEffect(()=>{
  const down=()=>{gesture.current=++serial.current;};
  const up=()=>{queueMicrotask(()=>{gesture.current=null;});};
  const key=(e:KeyboardEvent)=>{
   if(!(e.metaKey||e.ctrlKey)||e.altKey)return;
   const el=e.target instanceof Element?e.target:null;
   if(el?.closest('textarea,[contenteditable="true"],[role="textbox"]')||el instanceof HTMLInputElement&&!['range','checkbox','radio','button'].includes(el.type))return;
   const k=e.key.toLowerCase();
   if(k==='z'){e.preventDefault();e.shiftKey?redo():undo();}
   else if(k==='y'&&e.ctrlKey){e.preventDefault();redo();}
  };
  document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);document.addEventListener('keydown',key);
  window.addEventListener('blur',up);
  return()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);document.removeEventListener('keydown',key);window.removeEventListener('blur',up);};
 },[undo,redo]);
 return {value:state.present,set,undo,redo,canUndo:state.past.length>0,canRedo:state.future.length>0};
}
