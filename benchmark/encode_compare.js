const Benchmark = require('benchmark');
const BufferPlus = require('../src/index.js');
const sp = require('schemapack');
const ITEM_COUNT = 100;

const testJson = {
    field1: 0x12345678,
    field2: 'test string',
    field3: [],
    field4: {key1: 'string key', key2: 0x12345678, key3: []}
};

for (let i = 0; i < ITEM_COUNT; i++)
{
    testJson.field3.push('item' + (i + 1));
    testJson.field4.key3.push('key' + (i + 1));
}

const jsonFieldSchema = BufferPlus.createSchema('JsonField');
jsonFieldSchema.addField('key1', 'string');
jsonFieldSchema.addField('key2', 'uint32le');
jsonFieldSchema.addArrayField('key3', 'string');

const testSchema = BufferPlus.createSchema('test');
testSchema.addField('field1', 'uint32le');
testSchema.addField('field2', 'string');
testSchema.addArrayField('field3', 'string');
testSchema.addField('field4', jsonFieldSchema);
testSchema.build();

const testSchemaEncode = testSchema.encode;

const spSchema = sp.build({
    field1: 'uint32',
    field2: 'string',
    field3: ['string'],
    field4: {key1: 'string', key2: 'uint32', key3: ['string']}
});


//process.exit(0);

const bp = BufferPlus.allocUnsafe(32);
const suite = new Benchmark.Suite();

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
        value >>= 7;
    }
    buffer[gp.offset++] = value & 127;


    // while (value > 127) {
    //     buffer[gp.offset++] = (value & 127) | 128;
    //     value >>= 7;
    // }
    // buffer[gp.offset++] = value & 127;
}

function writeString(value, buffer)
{
    var len = Buffer.byteLength(value, 'utf8');
    writeVarUInt(len, buffer);
    gp.offset += buffer.write(value, gp.offset, len, 'utf8');
}

var gp = {
    offset: 0,
    allocUnsafe: Buffer.allocUnsafe,
    writeVarUInt: writeVarUInt,
    writeString: writeString,
};


var globalBuffer = gp.allocUnsafe(1317);

function nativeBufferWrite(json, gp)
{
    var ref1 = json;
    var ref2 = ref1;
    var ref3 = ref2['field3'];
    var ref4 = ref2['field4'];
    var ref5 = ref4['key3'];

    var wBuffer = gp.allocUnsafe(1317);
    gp.offset = 0;

    gp.offset = wBuffer.writeUInt32BE(ref2['field1'], gp.offset, true);

    gp.writeString(ref2['field2'], wBuffer);

    gp.writeVarUInt(ref3.length, wBuffer);
    for (var i = 0; i < ref3.length; i++)
    {
        gp.writeString(ref3[i], wBuffer);
    }


    gp.writeString(ref4['key1'], wBuffer);

    gp.offset = wBuffer.writeUInt32BE(ref4['key2'], gp.offset, true);

    gp.writeVarUInt(wBuffer, ref5.length);
    for (var j = 0; j < ref5.length; j++)
    {
        gp.writeString(ref5[j], wBuffer);
    }

    return wBuffer;
}

function schemaRawFunc(json, gp)
{
    var ref1 = json;
    //var ref2 = ref1['a'];
    var ref2 = ref1;
    var ref3 = ref2['field3'];
    var ref4 = ref2['field4'];
    var ref5 = ref4['key3'];

    var wBuffer = gp.allocUnsafe(1317);
    gp.offset = 0;

    gp.offset = wBuffer.writeUInt32BE(ref2['field1'], gp.offset, true);

    gp.writeString(ref2['field2'], wBuffer);
    gp.writeVarUInt(ref3.length, wBuffer);
    for (var j3 = 0; j3 < ref3.length; j3++) {
        gp.writeString(ref3[j3], wBuffer);
    }

    gp.writeString(ref4['key1'], wBuffer);

    gp.offset = wBuffer.writeUInt32BE(ref4['key2'], gp.offset, true);
    gp.writeVarUInt(ref5.length, wBuffer);
    for (var j5 = 0; j5 < ref5.length; j5++) {
        gp.writeString(ref5[j5], wBuffer);
    }
    return wBuffer;
}

var schemaRaw = new Function('json', 'gp', `
    var ref1 = json;
    var ref2 = ref1['a'];
    var ref3 = ref2['field3'];
    var ref4 = ref2['field4'];
    var ref5 = ref4['key3'];

    var wBuffer = gp.allocUnsafe(1317);
    gp.offset = 0;
    if (typeof(ref2['field1']) !== 'number' || ref2['field1'] < 0 || ref2['field1'] > 4294967295) {
        gp.throwTypeError(ref2['field1'], 'number', 0, 4294967295, 'uint32');
    }
    gp.offset = wBuffer.writeUInt32BE(ref2['field1'], gp.offset, true);
    if (typeof(ref2['field2']) !== 'string') {
        gp.throwTypeError(ref2['field2'], 'string');
    }
    gp.writeString(ref2['field2'], wBuffer);
    gp.writeVarUInt(ref3.length, wBuffer);
    for (var j3 = 0; j3 < ref3.length; j3++) {
        if (typeof(ref3[j3]) !== 'string') {
            gp.throwTypeError(ref3[j3], 'string');
        }
        gp.writeString(ref3[j3], wBuffer);
    }

    if (typeof(ref4['key1']) !== 'string') {
        gp.throwTypeError(ref4['key1'], 'string');
    }
    gp.writeString(ref4['key1'], wBuffer);

    if (typeof(ref4['key2']) !== 'number' || ref4['key2'] < 0 || ref4['key2'] > 4294967295) {
        gp.throwTypeError(ref4['key2'], 'number', 0, 4294967295, 'uint32');
    }

    gp.offset = wBuffer.writeUInt32BE(ref4['key2'], gp.offset, true);
    gp.writeVarUInt(ref5.length, wBuffer);
    for (var j5 = 0; j5 < ref5.length; j5++) {
        if (typeof(ref5[j5]) !== 'string') {
            gp.throwTypeError(ref5[j5], 'string');
        }
        gp.writeString(ref5[j5], wBuffer);
    }
    return wBuffer;
`);

function schemaEncode(json)
{
    const schemaJson = {'a': json};
    schemaRaw(schemaJson, gp);
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
// .add('Schemapack raw', function() {
//     const data = schemaEncode(testJson);
//     //console.log('data.legnth:' + data.length);
// })
// .add('Schemapack raw function', function() {
//     const data = schemaRawFunc(testJson, gp);
//     //console.log('data.legnth:' + data.length);
// })
.add('BP Schema', function() {
    bp.reset();
    //bp.writeSchema('test', testJson);
    //testSchema.encode(bp, testJson);
    testSchemaEncode.call(testSchema, bp, testJson);
})
.add('Schemapack', function() {
    const data = spSchema.encode(testJson);
    //const data = schemaRaw(schemaJson, gp);
    //console.log('data.legnth:' + data.length);
})
.add('Native Buffer', function() {
    //const data = schemaRawFunc(testJson, gp);
    const data = nativeBufferWrite(testJson, gp);
})
// .add('Native BP', function() {
//     bp.reset();

//     //if (!testJson instanceof Object) throw new TypeError("Invalid json data for encoder");
//     const strEnc = 'utf8';
//     bp.writeUInt32BEDirect(testJson.field1);
//     bp.writePackedStringDirect(testJson.field2, strEnc);

//     bp.writeVarUIntDirect(testJson.field3.length);
//     let field3_arr_len = testJson.field3.length;
//     for (let field3_iter = 0; field3_iter < field3_arr_len; field3_iter++)
//     {
//         bp.writePackedStringDirect(testJson.field3[field3_iter], strEnc);
//     }

//     const field4 = testJson.field4;
//     bp.writePackedStringDirect(field4.key1, strEnc);
//     bp.writeUInt32BEDirect(field4.key2.field1);

//     bp.writeVarUIntDirect(field4.key3.length);
//     let key3_len = field4.key3.length;
//     for (let j = 0; j < key3_len; j++)
//     {
//         bp.writePackedStringDirect(field4.key3[j], strEnc);
//     }
// })
;

suite.on('start', function() {
    console.log('on start');
})
.on('setup', function(name) {
}).on('cycle', function(event) {
    console.log(String(event.target));
    //global.gc();
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
.run({async: false, maxTime: 10.0});
