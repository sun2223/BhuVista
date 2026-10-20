import test from 'node:test';import assert from 'node:assert/strict';
import {lngLatToUtm,utmToLngLat,extentToBounds,validCodes} from '../geo.js';
test('Bihar EPSG:32645 conversion roundtrips WGS84 accurately',()=>{
 for(const [lng,lat] of [[85.1376,25.5941],[87.31,26.13],[84.1,24.9]]){
  const projected=lngLatToUtm(lng,lat);const back=utmToLngLat(projected.x,projected.y);
  assert.ok(Math.abs(back.lng-lng)<.000001);assert.ok(Math.abs(back.lat-lat)<.000001);
 }
});
test('computed bounds enclose all four geographic corners',()=>{
 const x=lngLatToUtm(85.1,25.5);const b=extentToBounds({xmin:x.x-50,xmax:x.x+50,ymin:x.y-50,ymax:x.y+50});
 assert.ok(b.south<25.5&&b.north>25.5&&b.west<85.1&&b.east>85.1);
});
test('reject malformed village identifiers',()=>{
 assert.ok(validCodes('07,01,01,0058,SS,00,00'));assert.ok(!validCodes('07,;drop table'));assert.ok(!validCodes('../../rest'));
});
