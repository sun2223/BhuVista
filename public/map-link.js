/** Share only map position and public Bihar location codes, never private records. */
const validCodes=codes=>Array.isArray(codes)&&codes.length===7&&codes.every(x=>/^[\w-]{1,40}$/.test(x));
export function makeMapQuery({mode='demo',lat,lng,zoom,base='satellite',codes}={}){
 const params=new URLSearchParams();
 const actualMode=mode==='official'?'official':'demo';
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error('Invalid map center');
 if(!Number.isFinite(zoom)||zoom<1||zoom>23)throw new Error('Invalid map zoom');
 params.set('view','1');params.set('mode',actualMode);
 params.set('lat',lat.toFixed(6));params.set('lng',lng.toFixed(6));params.set('zoom',String(Math.round(zoom)));
 params.set('base',['satellite','roadmap','hybrid'].includes(base)?base:'satellite');
 if(actualMode==='official'){
  if(!validCodes(codes))throw new Error('Load a Bihar village sheet before sharing');
  params.set('codes',codes.join(','));
 }
 return params.toString();
}
export function readMapQuery(search=''){
 const p=new URLSearchParams(search);
 if(p.get('view')!=='1')return null;
 const lat=Number(p.get('lat')),lng=Number(p.get('lng')),zoom=Number(p.get('zoom'));
 if(!p.has('lat')||!p.has('lng')||!p.has('zoom')||!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isInteger(zoom)||Math.abs(lat)>90||Math.abs(lng)>180||zoom<1||zoom>23)return null;
 const mode=p.get('mode')==='official'?'official':'demo';
 const codes=(p.get('codes')||'').split(',');
 if(mode==='official'&&!validCodes(codes))return null;
 const base=['satellite','roadmap','hybrid'].includes(p.get('base'))?p.get('base'):'satellite';
 return {mode,lat,lng,zoom,base,codes:mode==='official'?codes:null};
}
export function validVillageCodes(codes){return validCodes(codes);}
