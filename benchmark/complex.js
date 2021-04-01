/* eslint-disable no-console */
const Benchmark = require('benchmark');
const BufferPlus = require('../lib/index.js');
const suite = new Benchmark.Suite();


const schDef = require('./complex.def.json');
const schData = require('./complex.data.json');

const bp = BufferPlus.allocUnsafe(8192);

const schema = BufferPlus.createSchema('complex', schDef);


suite
.add('[Buffer Plus]', () => {
    bp.reset();
    schema.encode(bp, schData);
})
.add('[Native JSON.stringify]', () => {
    bp.reset();
    const data = JSON.stringify(schData);
    bp.writeString(data);
})
;

suite.on('start', () => {
    console.log('Benchmarking complex encode...');
})
.on('setup', (name) => {
}).on('cycle', (event) => {
    console.log(String(event.target));
    // global.gc();
})
.on('complete', function() {
    const fastest = this.filter('fastest');
    console.log('Fastest is ' + fastest.map('name'));
    let fhz;
    if (fastest.map('hz').length > 1) {
        fhz = fastest.map('hz')[0];
    } else {
        fhz = fastest.map('hz');
    }

    Array.prototype.forEach.call(this, (item) => {
      console.log(item.name + ' : ' + Math.round(fhz / item.hz * 100) + '% slower');
    });
})
.on('error', (err) => {
    console.log('got error:', err);
})
.run();
