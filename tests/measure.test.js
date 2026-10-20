import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceBetween,pathDistance,polygonArea,formatDistance,formatArea} from '../public/measure.js';

test('a one-degree equatorial segment is about 111.2 km',()=>{
  const meters=distanceBetween({lat:0,lng:0},{lat:0,lng:1});
  assert.ok(Math.abs(meters-111195)<30);
});
test('polyline path and polygon perimeter are separate',()=>{
  const p=[{lat:25,lng:85},{lat:25,lng:85.001},{lat:25.001,lng:85.001}];
  assert.ok(pathDistance(p)>200);
  assert.ok(pathDistance(p,true)>pathDistance(p));
  assert.equal(pathDistance([]),0);
});
test('parcel area is approximate, orientation-independent and requires three points',()=>{
  const square=[{lat:0,lng:0},{lat:0,lng:.001},{lat:.001,lng:.001},{lat:.001,lng:0}];
  const a=polygonArea(square);
  assert.ok(a>12000&&a<13000);
  assert.ok(Math.abs(a-polygonArea([...square].reverse()))<.00001);
  assert.equal(polygonArea(square.slice(0,2)),0);
});
test('measurements display readable units',()=>{
  assert.equal(formatDistance(500),'500.0 m');
  assert.equal(formatDistance(2500),'2.50 km');
  assert.equal(formatArea(15000),'1.50 ha');
  assert.equal(formatArea(100),'100 m²');
});
