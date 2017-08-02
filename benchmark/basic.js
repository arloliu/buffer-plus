const Benchmark = require('benchmark');
const BufferPlus = require('../lib/index.js');

const suite = new Benchmark.Suite();
const suite2 = new Benchmark.Suite();

let testStr = '';
for (let i = 0; i < 20; i++)
    testStr += 'test string ' + i;

let testArray = [];
for (let i = 0; i < 100; i++)
    testArray.push('item' + i);

const nativeBuf = Buffer.allocUnsafe(8192);
const bp = BufferPlus.allocUnsafe(8192);
suite
.add('Native writeString', function() {
    var offset = 0;
    offset += nativeBuf.write(testStr, offset, Buffer.byteLength(testStr), 'utf8');
    offset += nativeBuf.write(testStr, offset, Buffer.byteLength(testStr), 'utf8');
    offset += nativeBuf.write(testStr, offset, Buffer.byteLength(testStr), 'utf8');
})
.add('BP writeString', function() {
    bp.reset();
    bp.writeString(testStr);
    bp.writeString(testStr);
    bp.writeString(testStr);
})
;

suite2
.add('Native writeArray', function() {
    var offset = 0;
    offset = nativeBuf.writeUInt32LE(testArray.length, 0, true);
    for (var i = 0; i < testArray.length; i++)
    {
        offset += nativeBuf.write(testArray[i], offset, Buffer.byteLength(testArray[i]), 'utf8');
    }
})
.add('BP writeArray', function() {
    bp.reset();
    bp.writeUInt32LE(testArray.length);
    bp.writeArray(testArray, 'string');
})
;


suite
.on('cycle', function(event) {
    console.log(String(event.target));
})
.on('complete', function() {
    var fastest = this.filter('fastest');
    console.log('Fastest is ' + fastest.map('name'));
    var fhz = fastest.map('hz');
    Array.prototype.forEach.call(this, function(item) {
      console.log(item.name + ' : ' + Math.round(fhz / item['hz'] * 100) + '% slower');
    });
    suite2.run();
})
.on('error', function(err) {
    console.log('got error:', err.stack);
});

suite2
.on('cycle', function(event) {
    console.log(String(event.target));
})
.on('complete', function() {
    var fastest = this.filter('fastest');
    console.log('Fastest is ' + fastest.map('name'));
    var fhz = fastest.map('hz');
    Array.prototype.forEach.call(this, function(item) {
      console.log(item.name + ' : ' + Math.round(fhz / item['hz'] * 100) + '% slower');
    });

})
.on('error', function(err) {
    console.log('got error:', err.stack);
});

suite.run();