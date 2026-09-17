export type History<T>={present:T;past:T[];future:T[];group:number|null};
export type HistoryAction<T>={type:'set';value:T|((previous:T)=>T);group:number}|{type:'undo'|'redo'};
export function changeHistory<T>(state:History<T>,action:HistoryAction<T>):History<T>{
 if(action.type==='undo'){if(!state.past.length)return state;return {present:state.past.at(-1)!,past:state.past.slice(0,-1),future:[state.present,...state.future],group:null};}
 if(action.type==='redo'){if(!state.future.length)return state;return {present:state.future[0],past:[...state.past,state.present],future:state.future.slice(1),group:null};}
 if(action.type!=='set')return state;
 const next=typeof action.value==='function'?(action.value as (p:T)=>T)(state.present):action.value;
 if(JSON.stringify(next)===JSON.stringify(state.present))return state;
 return {present:next,past:state.group===action.group?state.past:[...state.past,state.present].slice(-100),future:[],group:action.group};
}
