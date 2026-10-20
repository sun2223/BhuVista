import {makeMapQuery,readMapQuery,validVillageCodes} from './map-link.js';
import {pathDistance,polygonArea,formatDistance,formatArea} from './measure.js';
/* BhuVista: two modes, a self-contained example and an official WMS image overlay.
 * Never treat the overlay as survey-grade or automatically infer ownership. */
const $ = id => document.getElementById(id);
const OFFICIAL='https://bhunaksha.bihar.gov.in/10/indexmain.jsp';
const LEVEL_NAMES=['District / जिला','Sub-division / अनुमंडल','Circle / अंचल','Mauza / मौजा','Survey type','Map instance','Sheet number'];
const state={mode:'demo',mapKind:null,map:null,googleData:null,featureLayer:null,labels:[],dataset:null,selected:null,neighborNos:new Set(),sheet:null,overlay:null,opacity:.85,showBoundaries:true,base:'satellite',googleKey:null,levels:[],lookupToken:0,plotPreviewUrl:null,measure:{active:false,type:'distance',points:[],layers:[]}};
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),6000);}
async function api(path){const r=await fetch(path);let data;try{data=await r.json();}catch{throw new Error('The map server returned an unexpected response.');}if(!r.ok)throw new Error(data.error||'Map request failed');return data;}
function escaped(s){return String(s==null?'—':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function rawSamples(){
 const countX=6,countY=5,x0=85.0637,y0=25.5681,dx=.00061,dy=.00055;
 const verts=[];
 for(let r=0;r<=countY;r++){verts[r]=[];for(let c=0;c<=countX;c++){
 const jigx=(r===0||r===countY||c===0||c===countX)?0:(Math.sin(r*19+c*8)*.000055);
 const jigy=(r===0||r===countY||c===0||c===countX)?0:(Math.cos(r*3+c*17)*.000043);
 verts[r][c]=[+(x0+c*dx+jigx).toFixed(7),+(y0+r*dy+jigy).toFixed(7)];
 }}
 const features=[];
 for(let r=0;r<countY;r++)for(let c=0;c<countX;c++){
  const n=1201+r*countX+c;
  const coords=[verts[r][c],verts[r][c+1],verts[r+1][c+1],verts[r+1][c],verts[r][c]];
  features.push({type:'Feature',properties:{plotNo:String(n),category:(r===2?'Residential':'Agricultural'),village:'Illustrative Mauza',source:'demo'},geometry:{type:'Polygon',coordinates:[coords]}});
 }
 return {type:'FeatureCollection',features};
}
function rings(feature){const g=feature.geometry;if(g.type==='Polygon')return [g.coordinates[0]];if(g.type==='MultiPolygon')return g.coordinates.map(poly=>poly[0]);return [];}
function allCoordinates(features){return features.flatMap(f=>rings(f).flat());}
function fitGeoJSON(dataset){const pts=allCoordinates(dataset.features);if(!pts.length)return;const lngs=pts.map(x=>x[0]),lats=pts.map(x=>x[1]);fitBounds({west:Math.min(...lngs),east:Math.max(...lngs),south:Math.min(...lats),north:Math.max(...lats)});}
function bboxCenter(bounds){return {lat:(bounds.south+bounds.north)/2,lng:(bounds.west+bounds.east)/2};}
function fitBounds(b){if(!state.map)return;if(state.mapKind==='google'){state.map.fitBounds(b,60);}else state.map.fitBounds([[b.south,b.west],[b.north,b.east]],{padding:[45,45]});}
function makeGoogleKeyUrl(key){return `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;}
function loadGoogle(key){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=makeGoogleKeyUrl(key);s.async=true;s.onload=()=>window.google?.maps?resolve():reject(new Error('Google SDK unavailable'));s.onerror=()=>reject(new Error('Google Maps could not load'));document.head.appendChild(s);});}
function initGoogle(){state.mapKind='google';state.map=new google.maps.Map($('map'),{center:{lat:25.569,lng:85.065},zoom:17,mapTypeId:'hybrid',streetViewControl:false,fullscreenControl:false,zoomControl:true,mapTypeControl:false,gestureHandling:'greedy',styles:[{featureType:'poi',stylers:[{visibility:'off'}]}]});
 state.googleData=state.map.data;state.map.data.addListener('click',e=>state.measure.active?addMeasurementPoint(e.latLng.lat(),e.latLng.lng()):selectPlot(String(e.feature.getProperty('plotNo'))));state.map.addListener('click',e=>handleMapClick(e.latLng.lat(),e.latLng.lng()));$('map-provider').textContent='Google Maps · cadastral data overlay';}
function initLeaflet(){if(!window.L)throw new Error('OpenStreetMap library unavailable. Check your internet connection.');state.mapKind='leaflet';state.map=L.map('map',{zoomControl:false}).setView([25.569,85.065],16);L.control.zoom({position:'bottomleft'}).addTo(state.map);state.tiles={roadmap:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap contributors'}),satellite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Imagery © Esri, Maxar, Earthstar Geographics and GIS User Community'}),hybrid:null};
 state.tiles.hybrid=state.tiles.satellite;
 state.tiles.satellite.addTo(state.map);
 state.map.on('click',e=>handleMapClick(e.latlng.lat,e.latlng.lng));$('map-provider').textContent='Esri satellite imagery · add Google API key for Google Maps';}
function clearMapLayers(){
 if(state.mapKind==='google'){
  state.map.data.forEach(f=>state.map.data.remove(f));
  state.labels.forEach(m=>m.setMap(null));
  if(state.overlay)state.overlay.setMap(null);
 }else if(state.mapKind==='leaflet'){
  if(state.featureLayer)state.map.removeLayer(state.featureLayer);
  state.labels.forEach(m=>state.map.removeLayer(m));
  if(state.overlay)state.map.removeLayer(state.overlay);
 }
 state.labels=[];state.overlay=null;state.featureLayer=null;
}
function coordCenter(f){const pts=rings(f)[0]||[];const unique=pts.slice(0,-1);if(!unique.length)return {lat:25.569,lng:85.065};return {lng:unique.reduce((s,p)=>s+p[0],0)/unique.length,lat:unique.reduce((s,p)=>s+p[1],0)/unique.length};}
function styleFor(plotNo){const sel=state.selected===plotNo,neighbor=state.neighborNos.has(plotNo);return {fillColor:sel?'#fbad52':neighbor?'#77cea0':'#31b185',fillOpacity:!state.showBoundaries?0:sel?.4:neighbor?.2:.13,strokeColor:sel?'#ff9d29':neighbor?'#61b77d':'#12b67d',strokeOpacity:state.showBoundaries?state.opacity:0,strokeWeight:sel?4:neighbor?3:2};}
function refreshStyle(){
 if(state.mapKind==='google'){
  state.map.data.setStyle(feature=>({ ...styleFor(String(feature.getProperty('plotNo'))),clickable:state.showBoundaries}));
  state.labels.forEach(m=>m.setVisible(state.showBoundaries));
 }else if(state.featureLayer){state.featureLayer.eachLayer(layer=>{const f=layer.feature;if(f)layer.setStyle(styleFor(String(f.properties.plotNo)));});state.labels.forEach(m=>m.setOpacity(state.showBoundaries?1:0));}
 if(state.overlay){if(state.mapKind==='google')state.overlay.setOpacity(state.showBoundaries?state.opacity:0);else state.overlay.setOpacity(state.showBoundaries?state.opacity:0);}
}
function drawDataset(data){resetMeasurement();clearMapLayers();state.dataset=data;state.sheet=null;state.selected=null;state.neighborNos=new Set();
 if(state.mapKind==='google'){
  state.map.data.addGeoJson(data);
  for(const f of data.features){const pt=coordCenter(f);const marker=new google.maps.Marker({map:state.map,position:pt,icon:{path:google.maps.SymbolPath.CIRCLE,scale:0},label:{text:String(f.properties.plotNo),fontSize:'10px',fontWeight:'700',color:'#134532'},clickable:false});state.labels.push(marker);}
 }else{
  state.featureLayer=L.geoJSON(data,{style:f=>styleFor(String(f.properties.plotNo)),onEachFeature:(f,layer)=>layer.on('click',e=>{L.DomEvent.stopPropagation(e);if(state.measure.active)addMeasurementPoint(e.latlng.lat,e.latlng.lng);else selectPlot(String(f.properties.plotNo));})}).addTo(state.map);
  for(const f of data.features){const p=coordCenter(f);const label=L.marker([p.lat,p.lng],{interactive:false,icon:L.divIcon({className:'',html:`<span class="map-label">${escaped(f.properties.plotNo)}</span>`,iconSize:[40,16],iconAnchor:[20,8]})}).addTo(state.map);state.labels.push(label);}
 }
 refreshStyle();fitGeoJSON(data);clearDetails();
}
function setBase(value){
 state.base=value;
 document.querySelectorAll('.base-btn').forEach(x=>x.classList.toggle('active',x.dataset.base===value));
 if(state.mapKind==='google'){state.map.setMapTypeId(value);return;}
 if(!state.tiles)return;
 const target=state.tiles[value];
 if(state.currentTile)state.map.removeLayer(state.currentTile);
 if(value==='hybrid'){
  state.map.removeLayer(state.tiles.roadmap);state.map.addLayer(state.tiles.satellite);state.currentTile=state.tiles.satellite;
 }else if(value==='satellite'){
  state.map.removeLayer(state.tiles.roadmap);state.map.addLayer(state.tiles.satellite);state.currentTile=state.tiles.satellite;
 }else{state.map.removeLayer(state.tiles.satellite);state.map.addLayer(state.tiles.roadmap);state.currentTile=state.tiles.roadmap;}
}
function edgeSet(f){const out=new Set();for(const ring of rings(f)){for(let i=0;i<ring.length-1;i++){
 const key=p=>p.map(v=>Number(v).toFixed(7)).join(',');const a=key(ring[i]),b=key(ring[i+1]);out.add([a,b].sort().join('~'));
 }}return out;}
function findNeighbors(target,features){const edges=edgeSet(target);return features.filter(f=>f!==target&&[...edgeSet(f)].some(x=>edges.has(x))).map(f=>String(f.properties.plotNo));}
function areaSqm(feature){let total=0;const lat=coordCenter(feature).lat*Math.PI/180;const scaleX=111320*Math.cos(lat),scaleY=110574;
 const polygons=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];
 for(const polygon of polygons)for(let h=0;h<polygon.length;h++){const ring=polygon[h], origin=ring[0];let twice=0;
  for(let i=0;i<ring.length-1;i++){const x1=(ring[i][0]-origin[0])*scaleX,y1=(ring[i][1]-origin[1])*scaleY,x2=(ring[i+1][0]-origin[0])*scaleX,y2=(ring[i+1][1]-origin[1])*scaleY;twice+=x1*y2-x2*y1;}
  total+=(h===0?1:-1)*Math.abs(twice)/2;
 }return Math.round(Math.max(0,total));}
function selectPlot(plot){if(!state.dataset)return;const f=state.dataset.features.find(x=>String(x.properties.plotNo)===String(plot));if(!f){toast(`Plot ${plot} not found in this dataset.`);return;}
 state.selected=String(plot);const neighbors=findNeighbors(f,state.dataset.features);state.neighborNos=new Set(neighbors);refreshStyle();const c=coordCenter(f);
 if(state.mapKind==='google')state.map.panTo(c);else state.map.panTo([c.lat,c.lng]);
 const demo=state.mode==='demo',source=demo?'ILLUSTRATIVE DATA': 'USER-IMPORTED GEOMETRY';
 $('detail-source').textContent=source;
 $('detail-title').textContent=`Plot ${plot}`;
 $('detail-body').innerHTML=`<div class="stat-grid"><div class="stat"><small>Plot / खेसरा</small><strong>${escaped(plot)}</strong></div><div class="stat"><small>Approx. area</small><strong>${areaSqm(f).toLocaleString('en-IN')} m²</strong></div></div><div class="detail-row"><span>Land class</span><strong>${escaped(f.properties.category||'Not available')}</strong></div><div class="detail-row"><span>Mauza</span><strong>${escaped(f.properties.village||'Not specified')}</strong></div><div class="detail-row"><span>Adjacent plots</span><strong>${neighbors.length}</strong></div><div class="neighbor-chips">${neighbors.map(n=>`<button type="button" data-neighbor="${escaped(n)}">${escaped(n)}</button>`).join('')||'No shared-edge neighbors found'}</div><div class="notice">${demo?'All plot numbers and boundaries here are fictional.':'Imported geometry is not independently verified.'} Ownership and legal area must be checked in the official records.</div>`;
 document.querySelectorAll('[data-neighbor]').forEach(btn=>btn.addEventListener('click',()=>selectPlot(btn.dataset.neighbor)));
 $('detail-card').style.display='block';}
function releasePlotPreview(){
  if(state.plotPreviewUrl){URL.revokeObjectURL(state.plotPreviewUrl);state.plotPreviewUrl=null;}
}
async function requestOfficialPlot(){
  if(state.mode!=='official'||!state.sheet){toast('Load an official village sheet first.');return;}
  const plot=$('official-plot-input').value.trim();
  if(!/^[\p{L}\p{N}/-]{1,36}$/u.test(plot)){toast('Enter a valid plot number (e.g. 1206 or 1206/1).');return;}
  const token=++state.lookupToken;
  releasePlotPreview();
  $('detail-card').style.display='block';
  $('detail-source').textContent='OFFICIAL PLOT IMAGE · NOT GEOLOCATED';
  $('detail-title').textContent=`Khesra ${plot}`;
  $('detail-body').innerHTML='<p>Requesting the documented BhuNaksha PlotImage service…</p>';
  const button=$('official-plot-button');button.disabled=true;
  try{
    const r=await fetch(`/api/plot-image?id=${encodeURIComponent(state.sheet.id)}&plot=${encodeURIComponent(plot)}`);
    if(!r.ok){const result=await r.json().catch(()=>({}));throw new Error(result.error||`Plot-image request failed (${r.status})`);}
    const blob=await r.blob();
    if(!blob.type.startsWith('image/'))throw new Error('The plot service did not return an image.');
    if(token!==state.lookupToken||state.mode!=='official')return;
    const objectUrl=URL.createObjectURL(blob);state.plotPreviewUrl=objectUrl;
    $('detail-body').innerHTML=`<div class="notice">This is a plot-map image requested using the selected village and khesra ${escaped(plot)}. It is not aligned to the satellite image and does not verify land ownership, identity, or exact location. Confirm the plot label and official LPM report on BhuNaksha.</div>`;
    const image=document.createElement('img');image.className='plot-preview';image.alt=`Official plot-image response for khesra ${plot}`;image.src=objectUrl;
    $('detail-body').append(image);
    const status=document.createElement('p');status.className='plot-preview-status';status.textContent='Preview returned by official service (not independently authenticated as the requested khesra).';$('detail-body').append(status);
  }catch(e){
    if(token!==state.lookupToken)return;
    $('detail-title').textContent=`Khesra ${plot}: preview unavailable`;
    $('detail-body').innerHTML=`<div class="notice">${escaped(e.message)} This government service may not support plot-image requests from our app. Please open official BhuNaksha and select the plot there.</div>`;
  }finally{if(token===state.lookupToken)button.disabled=!state.sheet;}
}
function handleMapClick(lat,lng){
 if(state.measure.active){addMeasurementPoint(lat,lng);return;}
 onMapClick(lat,lng);
}
function discardMeasurementLayers(){
 for(const layer of state.measure.layers){
  if(state.mapKind==='google')layer.setMap(null);
  else if(state.mapKind==='leaflet')state.map.removeLayer(layer);
 }
 state.measure.layers=[];
}
function renderMeasurement(){
 discardMeasurementLayers();
 const {points,type}=state.measure;
 const coords=points.map(p=>[p.lat,p.lng]);
 if(state.mapKind==='google'){
  if(points.length>=2){
   const geom=type==='area'&&points.length>=3
    ?new google.maps.Polygon({map:state.map,paths:points,strokeColor:'#e9c36d',strokeWeight:3,strokeOpacity:1,fillColor:'#f9b964',fillOpacity:.23,clickable:false})
    :new google.maps.Polyline({map:state.map,path:points,strokeColor:'#e9c36d',strokeWeight:3,clickable:false});
   state.measure.layers.push(geom);
  }
  for(const p of points){state.measure.layers.push(new google.maps.Circle({map:state.map,center:p,radius:2.5,strokeColor:'#613e18',strokeWeight:2,fillColor:'#ffebac',fillOpacity:1,clickable:false}));}
 }else if(state.mapKind==='leaflet'){
  if(points.length>=2){
   const options={color:'#f8bb53',weight:3,opacity:1,interactive:false};
   const layer=type==='area'&&points.length>=3?L.polygon(coords,{...options,fillColor:'#f8bb53',fillOpacity:.25}):L.polyline(coords,options);
   state.measure.layers.push(layer.addTo(state.map));
  }
  for(const p of points)state.measure.layers.push(L.circleMarker([p.lat,p.lng],{radius:5,color:'#59391c',weight:2,fillColor:'#ffebac',fillOpacity:1,interactive:false}).addTo(state.map));
 }
 const ready=type==='area'?points.length>=3:points.length>=2;
 const value=ready?(type==='area'?`${formatArea(polygonArea(points))} · perimeter ${formatDistance(pathDistance(points,true))}`:formatDistance(pathDistance(points))):`Add ${Math.max(0,(type==='area'?3:2)-points.length)} more point(s)`;
 $('measure-result').textContent=value;
 $('measure-guidance').textContent=`${points.length} point(s). Click the map to add ${type==='area'?'corners':'a route'}, then use Done.`;
 $('measure-undo').disabled=points.length===0;
 $('measure-clear').disabled=points.length===0;
}
function addMeasurementPoint(lat,lng){
 if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
 const pts=state.measure.points;
 if(pts.length>=100){toast('Maximum 100 measurement points.');return;}
 const point={lat,lng};
 if(pts.length&&pathDistance([pts.at(-1),point])<.05)return;
 pts.push(point);
 renderMeasurement();
}
function setMeasurementActive(active){
 state.measure.active=active;
 $('measure-panel').classList.toggle('hidden',!active);
 $('measure-toggle').classList.toggle('active',active);
 $('measure-toggle').setAttribute('aria-pressed',String(active));
 $('map').classList.toggle('is-measuring',active);
 if(state.mapKind==='google')state.map.setOptions({draggableCursor:active?'crosshair':null});
 if(active)renderMeasurement();
}
function resetMeasurement(){
 discardMeasurementLayers();
 state.measure.points=[];
 if(state.measure.active)renderMeasurement();
}
function chooseMeasureType(type){
 state.measure.type=type;
 state.measure.points=[];
 for(const choice of ['distance','area']){
  const b=$(`measure-${choice}`);b.classList.toggle('active',choice===type);b.setAttribute('aria-pressed',String(choice===type));
 }
 renderMeasurement();
}
function clearDetails(){ $('detail-source').textContent='PLOT EXPLORER';$('detail-title').textContent='Select any plot';$('detail-body').innerHTML='<div class="empty-graphic">⌗</div><p>Click inside a parcel boundary to inspect its plot number and nearby parcels.</p>';$('detail-card').style.display='block';}
async function onMapClick(lat,lng){if(state.mode!=='official'||!state.sheet)return;
 const token=++state.lookupToken;releasePlotPreview();
 $('detail-source').textContent='OFFICIAL MAP CLICK';$('detail-title').textContent='Checking location…';$('detail-body').innerHTML='<p>Asking the official map server whether this location has an identifiable plot.</p>';$('detail-card').style.display='block';
 try{const d=await api(`/api/identify?id=${encodeURIComponent(state.sheet.id)}&lat=${lat}&lng=${lng}`);
 if(token!==state.lookupToken)return;
 $('detail-title').textContent=d.found?`Possible plot ${d.plotNo}`:'Plot number not confirmed';
 $('detail-body').innerHTML=`<div class="detail-row"><span>Latitude</span><strong>${lat.toFixed(6)}</strong></div><div class="detail-row"><span>Longitude</span><strong>${lng.toFixed(6)}</strong></div><div class="notice">${escaped(d.message)} The overlay may be shifted; verify the exact parcel directly on BhuNaksha.</div>${d.found?'<button id="preview-from-click" class="primary-btn" type="button">Request plot-image preview ↗</button>':''}`;
 if(d.found){$('official-plot-input').value=d.plotNo;$('preview-from-click').addEventListener('click',requestOfficialPlot);}
 }catch(e){if(token!==state.lookupToken)return;$('detail-title').textContent='Lookup unavailable';$('detail-body').innerHTML=`<p>${escaped(e.message)}</p><div class="notice">Check the visible plot label on the official BhuNaksha map.</div>`;}}
function updateMode(mode){resetMeasurement();++state.lookupToken;releasePlotPreview();state.mode=mode;const official=mode==='official';$('official-plot-input').disabled=true;$('official-plot-button').disabled=true;$('demo-controls').classList.toggle('hidden',official);$('official-controls').classList.toggle('hidden',!official);$('tab-demo').classList.toggle('active',!official);$('tab-official').classList.toggle('active',official);$('map-hint').textContent=official?'✧ Choose a village to load its official cadastral layer':'✧ Click a sample plot to see its details and neighbors';if(!official){state.sheet=null;drawDataset(rawSamples());$('area-label').textContent='Sample plots · near Patna, Bihar';$('source-status').textContent='Sample dataset';$('detail-card').style.display='block';}else{clearMapLayers();state.sheet=null;state.dataset=null;clearDetails();$('area-label').textContent='Select official Bihar location';$('source-status').textContent='Official map (pending)';}if(innerWidth<760)document.body.classList.remove('sidebar-open');}
function populateLevels(){const c=$('level-fields');c.innerHTML='';LEVEL_NAMES.forEach((name,index)=>{
 const div=document.createElement('div');div.className='level-field';const label=document.createElement('label');label.textContent=name;label.htmlFor=`level-${index}`;
 const select=document.createElement('select');select.id=`level-${index}`;select.disabled=index!==0;select.innerHTML='<option value="">Select…</option>';select.addEventListener('change',()=>onLevelChange(index));div.append(label,select);c.append(div);state.levels.push(select);
 });return loadLevel(0).catch(e=>toast(e.message));}
async function loadLevel(index){if(index>=7)return;const codes=state.levels.slice(0,index).map(s=>s.value).join(',');const sel=state.levels[index];sel.innerHTML='<option value="">Loading…</option>';sel.disabled=true;
 try{const data=await api(`/api/levels?level=${index}&codes=${encodeURIComponent(codes)}`);sel.innerHTML='<option value="">Select…</option>';for(const opt of data.options){const option=document.createElement('option');option.value=opt.code;option.textContent=`${opt.code} ${opt.label}`;sel.appendChild(option);}sel.disabled=false;if(data.options.length===1&&!state.restoringView){sel.value=data.options[0].code;onLevelChange(index);}}
 catch(e){sel.innerHTML='<option value="">Service unavailable</option>';if(index===0)toast(`Official Bihar location service unavailable: ${e.message}`);}
}
function onLevelChange(index){++state.lookupToken;releasePlotPreview();state.sheet=null;$('official-plot-input').disabled=true;$('official-plot-button').disabled=true;for(let i=index+1;i<7;i++){state.levels[i].value='';state.levels[i].disabled=true;state.levels[i].innerHTML='<option value="">Select…</option>';}$('load-sheet').disabled=!state.levels.every(x=>x.value);if(state.levels[index].value&&index<6)loadLevel(index+1).catch(e=>toast(e.message));}
async function loadSheet(){const codes=state.levels.map(s=>s.value);if(codes.some(x=>!x))return;++state.lookupToken;releasePlotPreview();$('official-plot-input').disabled=true;$('official-plot-button').disabled=true;const btn=$('load-sheet');btn.disabled=true;btn.textContent='Loading government map…';
 try{const d=await api('/api/sheet?codes='+encodeURIComponent(codes.join(',')));resetMeasurement();clearMapLayers();state.dataset=null;state.sheet=d;state.selected=null;state.neighborNos=new Set();
 if(state.mapKind==='google'){state.overlay=new google.maps.GroundOverlay(d.mapImage,d.bounds,{opacity:state.opacity,clickable:false});state.overlay.setMap(state.map);}
 else{state.overlay=L.imageOverlay(d.mapImage,[[d.bounds.south,d.bounds.west],[d.bounds.north,d.bounds.east]],{opacity:state.opacity,interactive:false}).addTo(state.map);}
 fitBounds(d.bounds);refreshStyle();$('official-plot-input').disabled=false;$('official-plot-button').disabled=false;$('area-label').textContent=state.levels[3].selectedOptions[0]?.textContent||'Bihar cadastral map';$('source-status').textContent='Government map imagery';$('detail-source').textContent='LIVE OFFICIAL MAP';$('detail-title').textContent='BhuNaksha overlay';$('detail-body').innerHTML='<div class="notice">This is official cadastral map imagery, but placement over satellite imagery is approximate. Click a location to attempt official plot identification. Blank or unsupported replies are not proof of ownership.</div>';
 rememberVillage(codes);toast('Official cadastral map requested. Boundaries may be displaced due to georeferencing.');
 }catch(e){toast(`Could not load official map: ${e.message}`);}finally{btn.disabled=false;btn.innerHTML='Overlay official village map <span>↗</span>';}}
async function importFile(file){if(!file)return;try{if(file.size>10*1024*1024)throw Error('Maximum file size 10 MB.');const json=JSON.parse(await file.text());if(json.type!=='FeatureCollection'||!Array.isArray(json.features))throw Error('Expected a GeoJSON FeatureCollection.');if(json.crs&&!/4326|crs84/i.test(JSON.stringify(json.crs)))throw Error('Reproject the file to WGS84 (EPSG:4326) before importing.');
 const features=json.features.filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)).slice(0,3000).map((f,i)=>({type:'Feature',properties:{plotNo:String(f.properties?.plotNo??f.properties?.plot_no??f.properties?.KHESRA??f.properties?.khesra??f.properties?.khasra??f.properties?.PLOT_NO??`Unknown-${i+1}`),category:f.properties?.category??f.properties?.land_use??'',village:f.properties?.village??f.properties?.mauza??'Imported village'},geometry:f.geometry}));
 if(!features.length)throw Error('No polygon features found.');const coords=allCoordinates(features);if(coords.length>200000)throw Error('File has too many vertices.');if(coords.some(p=>!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90))throw Error('Coordinates must be longitude/latitude in WGS84 (EPSG:4326).');
 const data={type:'FeatureCollection',features};state.mode='imported';drawDataset(data);$('area-label').textContent=`Imported · ${file.name}`;$('source-status').textContent='Your GeoJSON (unverified)';$('map-hint').textContent='✧ Click a polygon from your imported file';toast(`${features.length} parcel geometries loaded. Data remains in this browser tab.`);
 }catch(e){toast('Import failed: '+e.message);}finally{$('import-file').value='';}}
function mapCamera(){
 if(state.mapKind==='google'){
  const c=state.map.getCenter();return {lat:c.lat(),lng:c.lng(),zoom:state.map.getZoom()};
 }
 const c=state.map.getCenter();return {lat:c.lat,lng:c.lng,zoom:state.map.getZoom()};
}
function setMapCamera({lat,lng,zoom}){
 if(state.mapKind==='google'){state.map.setCenter({lat,lng});state.map.setZoom(zoom);}
 else state.map.setView([lat,lng],zoom);
}
function savedVillage(){
 try{const c=JSON.parse(localStorage.getItem('bhuvista-last-village')||'null');return validVillageCodes(c)?c:null;}
 catch{return null;}
}
function rememberVillage(codes){
 try{localStorage.setItem('bhuvista-last-village',JSON.stringify(codes));$('restore-village').classList.remove('hidden');}
 catch{/* Private browsing may block localStorage. */}
}
async function restoreVillage(codes){
 if(!validVillageCodes(codes)){toast('No saved village found.');return false;}
 state.restoringView=true;
 try{
  for(let i=0;i<7;i++){
   const sel=state.levels[i];
   if(![...sel.options].some(o=>o.value===codes[i]))throw new Error('The government location list has changed. Select your village manually.');
   sel.value=codes[i];
   if(i<6)await loadLevel(i+1);
  }
  $('load-sheet').disabled=false;
  await loadSheet();
  return Boolean(state.sheet);
 }catch(e){toast(`Could not reopen village: ${e.message}`);return false;}
 finally{state.restoringView=false;}
}
async function copyMapView(){
 if(state.mode==='imported'){toast('Imported GeoJSON stays on this device; it cannot be included in a shareable link.');return;}
 try{
  const camera=mapCamera();
  const query=makeMapQuery({...camera,mode:state.mode,base:state.base,codes:state.sheet?state.levels.map(x=>x.value):null});
  const link=`${location.origin}${location.pathname}?${query}`;
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(link);toast('Map link copied! It works on other devices after you deploy the website.');}
  else{window.prompt('Copy this map view URL:',link);}
 }catch(e){toast(e.message||'Could not copy view.');}
}
async function boot(){
 $('share-view').addEventListener('click',copyMapView);
 $('restore-village').addEventListener('click',async()=>{updateMode('official');await restoreVillage(savedVillage());});
 $('measure-toggle').addEventListener('click',()=>setMeasurementActive(!state.measure.active));
 $('measure-distance').addEventListener('click',()=>chooseMeasureType('distance'));
 $('measure-area').addEventListener('click',()=>chooseMeasureType('area'));
 $('measure-undo').addEventListener('click',()=>{state.measure.points.pop();renderMeasurement();});
 $('measure-clear').addEventListener('click',resetMeasurement);
 $('measure-done').addEventListener('click',()=>setMeasurementActive(false));
 $('tab-demo').addEventListener('click',()=>updateMode('demo'));$('tab-official').addEventListener('click',()=>updateMode('official'));
 $('plot-search').addEventListener('keydown',e=>{if(e.key==='Enter')selectPlot($('plot-search').value.trim());});$('search-button').addEventListener('click',()=>selectPlot($('plot-search').value.trim()));$('try-1206').addEventListener('click',()=>{state.mode==='official'&&updateMode('demo');selectPlot('1206');});$('try-1211').addEventListener('click',()=>{state.mode==='official'&&updateMode('demo');selectPlot('1211');});
 $('import-file').addEventListener('change',e=>importFile(e.target.files?.[0]));$('load-sheet').addEventListener('click',loadSheet);$('official-plot-button').addEventListener('click',requestOfficialPlot);$('official-plot-input').addEventListener('keydown',e=>{if(e.key==='Enter')requestOfficialPlot();});$('opacity').addEventListener('input',e=>{state.opacity=Number(e.target.value)/100;$('opacity-value').textContent=`${e.target.value}%`;refreshStyle();});$('boundary-toggle').addEventListener('change',e=>{state.showBoundaries=e.target.checked;refreshStyle();});document.querySelectorAll('.base-btn').forEach(btn=>btn.addEventListener('click',()=>setBase(btn.dataset.base)));$('close-detail').addEventListener('click',()=>$('detail-card').style.display='none');$('open-sidebar').addEventListener('click',()=>document.body.classList.add('sidebar-open'));$('close-sidebar').addEventListener('click',()=>document.body.classList.remove('sidebar-open'));
 try{const config=await api('/api/config');state.googleKey=config.googleMapsApiKey||'';if(state.googleKey){try{await loadGoogle(state.googleKey);initGoogle();}catch(e){initLeaflet();toast('Google Maps unavailable, using alternate map tiles. '+e.message);}}else initLeaflet();const shared=readMapQuery(location.search);
  setBase(shared?.base||'satellite');updateMode(shared?.mode||'demo');
  if(savedVillage())$('restore-village').classList.remove('hidden');
  await populateLevels();
  if(shared?.mode==='official'&&shared.codes){
   const loaded=await restoreVillage(shared.codes);
   if(!loaded)toast('Shared map location could not be loaded; check the official selectors.');
  }
  if(shared)setMapCamera(shared);
 }catch(e){toast('Map startup failed: '+e.message);$('map').innerHTML='<div style="padding:130px 40px">Unable to load map. Check internet connectivity.</div>';}
}
boot();
