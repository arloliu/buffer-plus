const Benchmark = require('benchmark');
const BufferPlus = require('../src/index.js');
const sp = require('schemapack');
const ITEM_COUNT = 100;

const spSchema = sp.build({
    field1: 'uint32',
    field2: 'string',
    field3: ['string']
});

const testJson = {
    field1: 0x12345678,
    field2: 'test string',
    field3: [],
    //field4: {key1: 'string key', key2: 0x12345678, key3: []}
};

for (let i = 0; i < ITEM_COUNT; i++)
{
    testJson.field3.push('item' + (i + 1));
    //testJson.field4.key3.push('key' + (i + 1));
}

const jsonFieldSchema = BufferPlus.createSchema('JsonField');
jsonFieldSchema.addField('key1', 'string');
jsonFieldSchema.addField('key2', 'uint32le');
jsonFieldSchema.addArrayField('key3', 'string');

const testSchema = BufferPlus.createSchema('test');
testSchema.addField('field1', 'uint32le');
testSchema.addField('field2', 'string');
testSchema.addArrayField('field3', 'string');
//testSchema.addField('field4', jsonFieldSchema);
testSchema.build();

const testSchemaEncode = testSchema.encode;

//process.exit(0);

const bp = BufferPlus.allocUnsafe(32);
const suite = new Benchmark.Suite();

const gp = {
    offset: 0
};

function writeVarUInt(value, buffer)
{

    // while (value >= 2147483648) // value >= 2^31
    // {
    //     buffer[gp.offset++] = (value & 0xFF) | 0x80;
    //     value /= 128;
    // }

    while (value > 127)
    {
        buffer[gp.offset++] = (value & 0xFF) | 0x80;
        value >>>= 7;
    }
    buffer[gp.offset++] = value | 0;

    // while (value > 127) {
    //     buffer[gp.offset++] = (value & 127) | 128;
    //     value >>= 7;
    // }
    // buffer[gp.offset++] = value & 127;
}

function writeString(buffer, value)
{
    const len = Buffer.byteLength(value);
    writeVarUInt(len, buffer);
    buffer.write(value, gp.offset, len, 'utf8');
    gp.offset += len;
}

function nativeBufferWrite(value)
{
    gp.offset = 0;
    const buf = Buffer.allocUnsafe(709);
    gp.offset = buf.writeUInt32BE(value.field1, 0);

    writeString(buf, value.field2);

    const field3 = value.field3;

    writeVarUInt(field3.length, buf);
    for (let i = 0; i < field3.length; i++)
    {
        writeString(buf, field3[i]);
    }
}

// const bufPool = [];
// for (let i = 0; i < 100; i++)
// {
//     bufPool[i] = Buffer.allocUnsafe(128);
// }

// process.exit(0);
suite
// .add('JSON.stringify', function() {
//     const data = JSON.stringify(testJson);
// })
.add('Native BP', function() {
    bp.reset();

    //if (!testJson instanceof Object) throw new TypeError("Invalid json data for encoder");
    const strEnc = 'utf8';
    bp.writeUInt32LEDirect(testJson.field1);
    bp.writePackedStringDirect(testJson.field2, strEnc);

    bp.writeVarUIntDirect(testJson.field3.length);
    let field3_arr_len = testJson.field3.length;
    for (let field3_iter = 0; field3_iter < field3_arr_len; field3_iter++)
    {
        bp.writePackedStringDirect(testJson.field3[field3_iter], strEnc);
    }
})
.add('BP Schema', function() {
    bp.reset();
    //bp.writeSchema('test', testJson);
    //testSchema.encode(bp, testJson);
    testSchemaEncode.call(testSchema, bp, testJson);
})
.add('Schemapack', function() {
    const data = spSchema.encode(testJson);
})
.add('Native Buffer', function() {
    nativeBufferWrite(testJson);
})
;

suite.on('start', function() {
    console.log('on start');
})
.on('setup', function(name) {
    console.log('on setup');
    console.log(name);
}).on('cycle', function(event) {
    console.log('on cycle');
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
    console.log('got error:', err);
})
.run({async: true, maxTime: 3.0});
