import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMapQuery,readMapQuery,validVillageCodes} from '../public/map-link.js';
const codes=['07','01','01','0058','SS','00','00'];
test('demo shared map retains satellite view and location',()=>{
 const query=makeMapQuery({mode:'demo',lat:25.5681,lng:85.0637,zoom:17,base:'hybrid'});
 assert.deepEqual(readMapQuery('?'+query),{mode:'demo',lat:25.5681,lng:85.0637,zoom:17,base:'hybrid',codes:null});
});
test('official shared view includes all seven village location codes',()=>{
 const query=makeMapQuery({mode:'official',lat:26.05,lng:87.48,zoom:15,base:'satellite',codes});
 assert.deepEqual(readMapQuery(query).codes,codes);
});
test('bad query parameters cannot restore unsafe or out-of-range view',()=>{
 assert.equal(readMapQuery('?view=1&mode=official&lat=26&lng=85&zoom=14&codes=../../secret'),null);
 assert.equal(readMapQuery('?view=1&mode=demo&lat=999&lng=85&zoom=14'),null);
 assert.equal(readMapQuery('?view=1&mode=demo&lng=85&zoom=14'),null);
 assert.equal(readMapQuery('?mode=demo'),null);
 assert.equal(validVillageCodes(['01','01']),false);
 assert.throws(()=>makeMapQuery({mode:'official',lat:26,lng:85,zoom:14,codes:['../','02']}));
});
