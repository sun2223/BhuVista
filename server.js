import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {extentToBounds,lngLatToUtm,validCodes} from './geo.js';
import {parsePlotNumber, isPlotNumber, sniffImageType} from './plot.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const HOST='https://bhunaksha.bihar.gov.in';
const PORT=Number(process.env.PORT||3000);
const KEY=process.env.GOOGLE_MAPS_API_KEY||'';
const cache=new Map();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const send=(res,status,body,type='application/json; charset=utf-8')=>{
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(type.startsWith('application/json')?JSON.stringify(body):body);
};
const fail=(res,status,message)=>send(res,status,{error:message});
async function remote(url,opts={}) {
  const response=await fetch(url,{...opts,redirect:'error',signal:AbortSignal.timeout(14000),headers:{'User-Agent':'BhuNaksha-Explorer/1.0 (map preview)','Referer':`${HOST}/10/indexmain.jsp`,...(opts.headers||{})}});
  if(!response.ok) throw new Error(`Official map service responded ${response.status}`);
  return response;
}
async function postJSON(endpoint,fields) {
  const body=new URLSearchParams(fields);
  const r=await remote(`${HOST}${endpoint}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  return r.json();
}
function getCached(id) {
  const entry=cache.get(id);
  if(!entry || Date.now()-entry.created>20*60_000) throw new Error('Map session expired. Please load the village again.');
  return entry;
}
function cleanExtent(v) {
  const {xmin,ymin,xmax,ymax}=Object.fromEntries(['xmin','ymin','xmax','ymax'].map(k=>[k,Number(v[k])]));
  if(![xmin,ymin,xmax,ymax].every(Number.isFinite)||xmax<=xmin||ymax<=ymin||xmax-xmin>30000||ymax-ymin>30000) throw new Error('Official portal did not return usable projected bounds.');
  return {xmin,ymin,xmax,ymax};
}
async function handleAPI(url,res){
  if(url.pathname==='/api/config') return send(res,200,{googleMapsApiKey:KEY,officialPortal:`${HOST}/10/indexmain.jsp`});
  if(url.pathname==='/api/health') return send(res,200,{ok:true,service:'BhuVista',officialConnection:'not tested by health check'});
  if(url.pathname==='/api/levels') {
    const level=Number(url.searchParams.get('level'));const codes=url.searchParams.get('codes')||'';
    if(!Number.isInteger(level)||level<0||level>8||(codes&&!validCodes(codes))) return fail(res,400,'Invalid location selection.');
    const data=await postJSON('/rest/Levels/ListsAfterLevel',{state:'10',level:String(level),codes:codes?codes.replace(/,+$/, '')+',':'',hasmap:'true'});
    const rows=Array.isArray(data?.[0])?data[0]:[];
    return send(res,200,{options:rows.filter(r=>r?.extraParms?.hasData!==false).map(r=>({code:String(r.code),label:String(r.value||r.code)}))});
  }
  if(url.pathname==='/api/sheet'){
    const codes=url.searchParams.get('codes')||'';
    if(!validCodes(codes)||codes.split(',').filter(Boolean).length!==7) return fail(res,400,'Please select all 7 Bihar location levels.');
    const info=await postJSON('/rest/MapInfo/getVVVVExtentGeoref',{state:'10',gisLevels:codes.replace(/,+$/,'')+',',srs:'0'});
    const extent=cleanExtent(info);
    if(!/^[\w-]{3,120}$/.test(String(info.gisCode||''))) throw new Error('The official portal returned an invalid map identifier.');
    const bounds=extentToBounds(extent);
    if(bounds.south<23||bounds.north>28.5||bounds.west<82||bounds.east>89.5) throw new Error('Georeferenced bounds are outside Bihar; overlay would be misleading.');
    const id=randomUUID();cache.set(id,{created:Date.now(),gisCode:info.gisCode,extent,bounds,codes});
    if(cache.size>200) for(const [k,v] of cache) if(Date.now()-v.created>20*60_000)cache.delete(k);
    return send(res,200,{id,bounds,extent,attribution:String(info.attribution||'Bihar BhuNaksha'),source:'BhuNaksha Bihar public map imagery; alignment not surveyed accuracy',mapImage:`/api/wms?id=${id}`});
  }
  if(url.pathname==='/api/wms'){
    const entry=getCached(url.searchParams.get('id'));const b=entry.extent;
    const width=1400, height=Math.max(200,Math.min(1800,Math.round(1400*(b.ymax-b.ymin)/(b.xmax-b.xmin))));
    const qs=new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetMap',LAYERS:'VILLAGE_MAP',STYLES:'VILLAGE_MAP',FORMAT:'image/png',TRANSPARENT:'true',state:'10',gis_code:entry.gisCode,CRS:'EPSG:32645',WIDTH:String(width),HEIGHT:String(height),BBOX:`${b.xmin},${b.ymin},${b.xmax},${b.ymax}`});
    const r=await remote(`${HOST}/WMS?${qs}`);
    const ct=r.headers.get('content-type')||'';
    if(!ct.includes('image/'))throw new Error('The official map service did not return an image.');
    const bytes=Buffer.from(await r.arrayBuffer());
    if(bytes.length>12*1024*1024)throw new Error('Map image exceeded limit.');
    return send(res,200,bytes,'image/png');
  }
  if(url.pathname==='/api/plot-image'){
    const entry=getCached(url.searchParams.get('id'));
    const plotNo=url.searchParams.get('plot')||'';
    if(!isPlotNumber(plotNo)) return fail(res,400,'Enter a valid plot number (digits, letters, / or -).');
    // NIC BhuNaksha 3.0 documents this PlotImage service. Bihar availability is not guaranteed.
    const qs=new URLSearchParams({state:'10',giscode:entry.gisCode,plotno:plotNo});
    let response;
    try { response=await remote(`${HOST}/rest/PlotImage?${qs}`); }
    catch { return fail(res,502,'The official PlotImage service did not respond with a plot map. Check the plot on Bihar BhuNaksha.'); }
    const declaredLength=Number(response.headers.get('content-length')||0);
    if(declaredLength>8*1024*1024) return fail(res,502,'Official plot image was too large.');
    const bytes=Buffer.from(await response.arrayBuffer());
    const imageType=sniffImageType(bytes);
    if(!imageType||bytes.length>8*1024*1024)return fail(res,502,'The official PlotImage service did not return a supported image. This does not mean the plot is absent.');
    return send(res,200,bytes,imageType);
  }
  if(url.pathname==='/api/identify'){
    const entry=getCached(url.searchParams.get('id'));const lat=Number(url.searchParams.get('lat'));const lng=Number(url.searchParams.get('lng'));
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<entry.bounds.south-0.1||lat>entry.bounds.north+0.1||lng<entry.bounds.west-0.1||lng>entry.bounds.east+0.1)return fail(res,400,'Click is outside the selected map.');
    const xy=lngLatToUtm(lng,lat);const d=35;
    const bbox=`${xy.x-d},${xy.y-d},${xy.x+d},${xy.y+d}`;
    // Different WMS servers expose GetFeatureInfo in different formats.
    // Limit to two requests and only trust an explicit parcel-number field.
    for(const format of ['application/json','text/plain']){
      const q=new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetFeatureInfo',LAYERS:'VILLAGE_MAP',QUERY_LAYERS:'VILLAGE_MAP',FEATURE_COUNT:'5',INFO_FORMAT:format,CRS:'EPSG:32645',WIDTH:'501',HEIGHT:'501',I:'250',J:'250',BBOX:bbox,state:'10',gis_code:entry.gisCode});
      try{
        const r=await remote(`${HOST}/WMS?${q}`);
        const declaredSize=Number(r.headers.get('content-length')||0);
        if(declaredSize>32_000)continue;
        const content=(await r.text()).slice(0,32_000);
        if(/<(?:html|!doctype|serviceexception|exceptionreport)|not supported|service exception/i.test(content.slice(0,500)))continue;
        const number=parsePlotNumber(content,format);
        if(number)return send(res,200,{found:true,plotNo:number,method:`official WMS GetFeatureInfo (${format})`,verified:false,message:'Candidate khesra number returned by map service. Confirm it in official Plot Info; satellite alignment may be imperfect.'});
      }catch{/* A non-queryable WMS is normal; try the next supported format. */}
    }
    return send(res,200,{found:false,plotNo:null,verified:false,message:'The government image layer did not return an identifiable plot number. You can enter a khesra number below to request an official plot-image preview, or use the government portal.'});
  }
  return fail(res,404,'Unknown API endpoint.');
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(req.method!=='GET')return fail(res,405,'Method not allowed');
  try {
    if(url.pathname.startsWith('/api/'))return await handleAPI(url,res);
    const pathname=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if(!['index.html','app.js','measure.js','map-link.js','styles.css','sample.geojson'].includes(pathname))return fail(res,404,'Not found');
    const filepath=path.join(root,'public',pathname);
    const body=await readFile(filepath);
    return send(res,200,body,mime[path.extname(pathname)]||'application/octet-stream');
  }catch(e){console.error('[BhuVista]',e.message);return fail(res,502,e.message==='fetch failed'?'Could not reach the official BhuNaksha service. Try again later.':String(e.message||'Request failed.'));}
});
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))server.listen(PORT,()=>console.log(`BhuVista running on http://localhost:${PORT}`));
export {server};
