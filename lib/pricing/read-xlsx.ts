import JSZip from 'jszip';
export type Workbook={SheetNames:string[];Sheets:Record<string,unknown[][]>};
// Read cell values without evaluating formulas, external links, or macros.
export async function readWorkbook(buffer:ArrayBuffer):Promise<Workbook>{
 if(buffer.byteLength>15*1024*1024)throw new Error('Use a workbook smaller than 15 MB.');
 const zip=await JSZip.loadAsync(buffer);
 async function xml(path:string){const entry=zip.file(path);if(!entry)throw new Error('Missing workbook data: '+path);const text=await entry.async('string');if(text.length>15000000)throw new Error('Workbook sheet is too large.');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw new Error('Invalid workbook XML');return doc}
 const strings=zip.file('xl/sharedStrings.xml')?Array.from((await xml('xl/sharedStrings.xml')).getElementsByTagName('si')).map(si=>Array.from(si.getElementsByTagName('t')).map(t=>t.textContent??'').join('')):[];
 const workbook=await xml('xl/workbook.xml'),rels=await xml('xl/_rels/workbook.xml.rels');
 const targets=new Map(Array.from(rels.getElementsByTagName('Relationship')).map(r=>[r.getAttribute('Id'),r.getAttribute('Target')??'']));
 const result:Workbook={SheetNames:[],Sheets:{}};
 for(const sheet of Array.from(workbook.getElementsByTagName('sheet'))){
  const name=sheet.getAttribute('name')??'',target=targets.get(sheet.getAttribute('r:id'));
  if(!target)continue;const file=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');
  const doc=await xml(file),rows:unknown[][]=[];
  for(const row of Array.from(doc.getElementsByTagName('row'))){const values:unknown[]=[];for(const c of Array.from(row.getElementsByTagName('c'))){const letters=(c.getAttribute('r')??'A').replace(/\d/g,'');let col=0;for(const ch of letters)col=col*26+ch.charCodeAt(0)-64;const value=c.getElementsByTagName('v')[0]?.textContent??'';const type=c.getAttribute('t');values[col-1]=type==='s'?strings[Number(value)]??'':type==='inlineStr'?c.getElementsByTagName('t')[0]?.textContent??'':value!==''&&Number.isFinite(Number(value))?Number(value):value}rows.push(values)}
  result.SheetNames.push(name);result.Sheets[name]=rows;
 }
 return result;
}
