// Minimal, conservative parsing of public GIS feature-info responses.
// Never treat a random ID, a village ID, or owner metadata as a plot number.
export function isPlotNumber(value){
  return typeof value==='string' && value.length>0 && value.length<=36 && /^[\p{L}\p{N}\/-]+$/u.test(value);
}
const plotField=/^(?:plot_?no|plot_?number|plotno|khesra(?:_?no|_?number)?|khasra(?:_?no|_?number)?|parcel_?no|parcel_?number)$/i;
function scanJson(value,depth=0){
  if(depth>6 || value==null || typeof value!=='object')return null;
  if(Array.isArray(value)){
    for(const item of value){const result=scanJson(item,depth+1);if(result)return result;}
    return null;
  }
  for(const [key,val] of Object.entries(value)){
    if(plotField.test(key) && (typeof val==='string'||typeof val==='number') && isPlotNumber(String(val)))return String(val);
  }
  for(const [key,val] of Object.entries(value)){
    if(['features','properties','attributes','results','data'].includes(key.toLowerCase())){
      const result=scanJson(val,depth+1);if(result)return result;
    }
  }
  return null;
}
export function parsePlotNumber(text,format='text/plain'){
  if(typeof text!=='string'||text.length>32_000)return null;
  if(format==='application/json'){
    try{return scanJson(JSON.parse(text));}catch{return null;}
  }
  // Text/WMS responses like "plot_no = 1206" or "Khesra Number: 1206".
  const match=text.match(/(?:^|[\r\n,;\s{])(?:plot[ _-]*(?:no|number)|plotno|khesra[ _-]*(?:no|number)?|khasra[ _-]*(?:no|number)?|parcel[ _-]*(?:no|number))\s*[:=]\s*["']?([\p{L}\p{N}\/-]{1,36})/imu);
  return match&&isPlotNumber(match[1])?match[1]:null;
}
export function sniffImageType(buffer){
  if(!Buffer.isBuffer(buffer))return null;
  if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(buffer.length>=3&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return 'image/jpeg';
  if(buffer.length>=6&&buffer.subarray(0,4).toString()==='GIF8')return 'image/gif';
  if(buffer.length>=12&&buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP')return 'image/webp';
  return null;
}
