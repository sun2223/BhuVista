// WGS84 / UTM zone 45N (EPSG:32645) conversions for Bihar.
const a = 6378137, e2 = 0.0066943799901413165, ep2 = e2/(1-e2), k0 = 0.9996;
const rad = Math.PI / 180;
export function utmToLngLat(easting, northing) {
  if (![easting, northing].every(Number.isFinite) || easting < 100000 || easting > 900000 || northing < 0 || northing > 10000000) throw new Error('Invalid Bihar projected bounds.');
  const x = easting - 500000, y = northing;
  const M = y / k0;
  const mu = M / (a * (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256));
  const e1 = (1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  const fp = mu + (3*e1/2-27*e1**3/32)*Math.sin(2*mu) + (21*e1**2/16-55*e1**4/32)*Math.sin(4*mu) + (151*e1**3/96)*Math.sin(6*mu) + (1097*e1**4/512)*Math.sin(8*mu);
  const C = ep2*Math.cos(fp)**2;
  const T = Math.tan(fp)**2;
  const N = a/Math.sqrt(1-e2*Math.sin(fp)**2);
  const R = a*(1-e2)/(1-e2*Math.sin(fp)**2)**1.5;
  const D = x/(N*k0);
  const lat = fp - (N*Math.tan(fp)/R)*(D**2/2-(5+3*T+10*C-4*C*C-9*ep2)*D**4/24+(61+90*T+298*C+45*T*T-252*ep2-3*C*C)*D**6/720);
  const lon0 = (45*6-183)*rad; // 87 degrees East
  const lon = lon0 + (D-(1+2*T+C)*D**3/6+(5-2*C+28*T-3*C*C+8*ep2+24*T*T)*D**5/120)/Math.cos(fp);
  return {lat: lat/rad, lng: lon/rad};
}
export function lngLatToUtm(lng, lat) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('Invalid longitude/latitude.');
  const p=lat*rad, lam=lng*rad, l0=87*rad;
  const N=a/Math.sqrt(1-e2*Math.sin(p)**2), T=Math.tan(p)**2, C=ep2*Math.cos(p)**2, A=Math.cos(p)*(lam-l0);
  const M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*p-(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*p)+(15*e2**2/256+45*e2**3/1024)*Math.sin(4*p)-(35*e2**3/3072)*Math.sin(6*p));
  return {x:k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120)+500000,y:k0*(M+N*Math.tan(p)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720))};
}
export function extentToBounds(v) {
  const corners = [[v.xmin,v.ymin],[v.xmin,v.ymax],[v.xmax,v.ymin],[v.xmax,v.ymax]].map(([x,y])=>utmToLngLat(x,y));
  return {south:Math.min(...corners.map(p=>p.lat)),west:Math.min(...corners.map(p=>p.lng)),north:Math.max(...corners.map(p=>p.lat)),east:Math.max(...corners.map(p=>p.lng))};
}
export function validCodes(str) {
  return typeof str === 'string' && str.length <= 120 && /^([A-Za-z0-9_]+,?){1,10}$/.test(str) && str.split(',').filter(Boolean).length <= 8;
}
