const Benchmark = require('benchmark');
const BufferPlus = require('../src/index.js');

const suite = new Benchmark.Suite();

let testStr = '';
for (let i = 0; i < 20; i++)
    testStr += 'a' + i;

const nativeBuf = Buffer.allocUnsafe(8192);
const bp = BufferPlus.allocUnsafe(8192);
suite
.add('Native writeString', function() {
    let offset = 0;
    offset += nativeBuf.write(testStr, offset);
    offset += nativeBuf.write(testStr, offset);
    offset += nativeBuf.write(testStr, offset);
})
.add('BP writeString', function() {
    bp.reset();
    bp.writeString(testStr);
    bp.writeString(testStr);
    bp.writeString(testStr);
})
.add('BP writeStringDirect', function() {
    bp.reset();
    bp.writeStringDirect(testStr);
    bp.writeStringDirect(testStr);
    bp.writeStringDirect(testStr);
})
;


suite.on('start', function() {

})
.on('cycle', function(event) {
    console.log(String(event.target));
})
.on('complete', function() {
    var fastest = this.filter('fastest');
    console.log('Fastest is ' + fastest.map('name'));
    var fhz = fastest.map('hz');
    Array.prototype.forEach.call(this, function(item) {
      console.log(item['name'] + ' : ' + Math.round(fhz / item['hz'] * 100) + '% slower');
    });

})
.on('error', function(err) {
    console.log('got error:', err.stack);
})
.run({async: false, maxTime: 1.0, minSample: 0});
