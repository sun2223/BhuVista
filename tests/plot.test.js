import test from 'node:test';
import assert from 'node:assert/strict';
import {isPlotNumber,parsePlotNumber,sniffImageType} from '../plot.js';

test('accept expected Bihar plot numbers but reject unsafe input',()=>{
  for(const n of ['1206','1206/1','45-A','१२३']) assert.equal(isPlotNumber(n),true);
  for(const n of ['','../../admin','1206?gis=evil','hello world','x'.repeat(50)]) assert.equal(isPlotNumber(n),false);
});
test('feature lookup only recognizes explicit plot number fields',()=>{
  assert.equal(parsePlotNumber('{"type":"FeatureCollection","features":[{"properties":{"PLOT_NO":"1206","ownerName":"private"}}]}','application/json'),'1206');
  assert.equal(parsePlotNumber('{"type":"Feature","properties":{"id":"1206","ownerName":"123"}}','application/json'),null);
  assert.equal(parsePlotNumber('khesra no: 1206\nkhata: 22','text/plain'),'1206');
  assert.equal(parsePlotNumber('<html><body>plotno=1206</body></html>','application/json'),null);
});
test('only accepts recognized image file signatures',()=>{
  assert.equal(sniffImageType(Buffer.from([137,80,78,71,13,10,26,10,0])),'image/png');
  assert.equal(sniffImageType(Buffer.from([255,216,255,224])),'image/jpeg');
  assert.equal(sniffImageType(Buffer.from('<html>fake image</html>')),null);
  assert.equal(sniffImageType(Buffer.from('%PDF-1.5')),null);
});
