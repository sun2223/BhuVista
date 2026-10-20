import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.js';
let base;

test.before(async () => {await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
test.after(async()=>{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));});
test('health reports local availability without claiming official connectivity',async()=>{
 const r=await fetch(`${base}/api/health`);const o=await r.json();assert.equal(r.status,200);assert.equal(o.ok,true);assert.match(o.officialConnection,/not tested/);
});
test('frontend files and config are served',async()=>{
 const [page,app,measure,share,cfg]=await Promise.all([fetch(base),fetch(`${base}/app.js`),fetch(`${base}/measure.js`),fetch(`${base}/map-link.js`),fetch(`${base}/api/config`)]);
 assert.equal(page.status,200);assert.match(await page.text(),/BhuVista/);
 assert.equal(app.status,200);assert.match(await app.text(),/function selectPlot/);
 assert.equal(measure.status,200);assert.match(await measure.text(),/distanceBetween/);
 assert.equal(share.status,200);assert.match(await share.text(),/makeMapQuery/);
 assert.equal((await cfg.json()).officialPortal,'https://bhunaksha.bihar.gov.in/10/indexmain.jsp');
});
test('reject missing or unsafe location inputs before contacting government service',async()=>{
 const [missing,unsafe]=await Promise.all([fetch(`${base}/api/sheet?codes=07`),fetch(`${base}/api/levels?level=1&codes=../../path`)]);
 assert.equal(missing.status,400);assert.equal(unsafe.status,400);
});

test('documented plot image route returns official image only after loading a sheet', async()=>{
 const original=globalThis.fetch;
 const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 const seen=[];
 globalThis.fetch=async(input,opts)=>{
   const address=String(input);
   if(!address.startsWith('https://bhunaksha.bihar.gov.in/'))return original(input,opts);
   seen.push(address);
   if(address.includes('/rest/MapInfo/getVVVVExtentGeoref')){
     return new Response(JSON.stringify({gisCode:'0701010058SS0000',xmin:548900,ymin:2881200,xmax:549900,ymax:2882200}),{status:200,headers:{'content-type':'application/json'}});
   }
   if(address.includes('/rest/PlotImage?'))return new Response(png,{status:200,headers:{'content-type':'image/png'}});
   throw Error('Unexpected upstream request: '+address);
 };
 try{
   const sheetRes=await original(`${base}/api/sheet?codes=07,01,01,0058,SS,00,00`);
   assert.equal(sheetRes.status,200);
   const sheet=await sheetRes.json();assert.ok(sheet.id);assert.ok(sheet.bounds.south>23);
   const plotRes=await original(`${base}/api/plot-image?id=${sheet.id}&plot=1206%2F1`);
   assert.equal(plotRes.status,200);assert.equal(plotRes.headers.get('content-type'),'image/png');
   assert.equal(Buffer.compare(Buffer.from(await plotRes.arrayBuffer()),png),0);
   assert.ok(seen.some(x=>x.includes('/rest/PlotImage?')&&x.includes('plotno=1206%2F1')&&x.includes('giscode=0701010058SS0000')));
   const bad=await original(`${base}/api/plot-image?id=${sheet.id}&plot=1206%3Fbad`);
   assert.equal(bad.status,400);
 }finally{globalThis.fetch=original;}
});
test('reject official plot-image responses that are HTML or errors',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(input,opts)=>{
   if(!String(input).startsWith('https://bhunaksha.bihar.gov.in/'))return original(input,opts);
   if(String(input).includes('/rest/MapInfo/'))return new Response(JSON.stringify({gisCode:'0701010058SS0000',xmin:548900,ymin:2881200,xmax:549900,ymax:2882200}));
   return new Response('<html>service unavailable</html>',{status:200,headers:{'content-type':'text/html'}});
 };
 try{
   const sheet=await (await original(`${base}/api/sheet?codes=07,01,01,0058,SS,00,00`)).json();
   const response=await original(`${base}/api/plot-image?id=${sheet.id}&plot=1206`);
   assert.equal(response.status,502);
   assert.match((await response.json()).error,/not return a supported image/);
 }finally{globalThis.fetch=original;}
});
