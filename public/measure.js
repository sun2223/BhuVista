/** Rough WGS84 ground measurements for on-screen exploration (not cadastral survey). */
const RAD=Math.PI/180;
const EARTH_RADIUS=6371008.8;
export function distanceBetween(a,b){
  const dLat=(b.lat-a.lat)*RAD,dLng=(b.lng-a.lng)*RAD;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(dLng/2)**2;
  return 2*EARTH_RADIUS*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function pathDistance(points,closed=false){
  let distance=0;
  for(let i=1;i<points.length;i++)distance+=distanceBetween(points[i-1],points[i]);
  if(closed&&points.length>=3)distance+=distanceBetween(points.at(-1),points[0]);
  return distance;
}
export function polygonArea(points){
  if(points.length<3)return 0;
  // Local tangent-plane approximation, suitable for small parcels but not legal area.
  const meanLat=points.reduce((sum,p)=>sum+p.lat,0)/points.length*RAD;
  const xScale=EARTH_RADIUS*Math.cos(meanLat)*RAD;
  const yScale=EARTH_RADIUS*RAD;
  const origin=points[0];
  let twiceArea=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    const x1=(a.lng-origin.lng)*xScale,y1=(a.lat-origin.lat)*yScale;
    const x2=(b.lng-origin.lng)*xScale,y2=(b.lat-origin.lat)*yScale;
    twiceArea+=x1*y2-x2*y1;
  }
  return Math.abs(twiceArea)/2;
}
export function formatDistance(meters){
  return meters>=1000?`${(meters/1000).toFixed(2)} km`:`${meters.toFixed(1)} m`;
}
export function formatArea(sqm){
  return sqm>=10000?`${(sqm/10000).toFixed(2)} ha`:`${Math.round(sqm).toLocaleString('en-IN')} m²`;
}
