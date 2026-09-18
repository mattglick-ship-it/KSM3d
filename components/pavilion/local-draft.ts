import {designSchema,type Design} from './designer-model';
export const DRAFT_KEY='ksm-pavilion-draft.v1';
export function readDraft(storage:Pick<Storage,'getItem'>):Design|null{
 try {const raw=storage.getItem(DRAFT_KEY);if(!raw)return null;const result=designSchema.safeParse(JSON.parse(raw));return result.success?result.data:null;}catch{return null;}
}
export function writeDraft(storage:Pick<Storage,'setItem'>,design:Design){
 storage.setItem(DRAFT_KEY,JSON.stringify(design));
}
