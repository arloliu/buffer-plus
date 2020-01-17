/* eslint-disable no-console, no-param-reassign, no-use-before-define */
const Benchmark = require('benchmark');
const BufferPlus = require('../src/index.js');
const sp = require('schemapack');

const bp = BufferPlus.allocUnsafe(32);

const ITEM_COUNT = 100;

const testJson = {
    field1: 0x12345678,
    field2: 'test string',
    field3: [],
    field4: {key1: 'string key', key2: 0x12345678, key3: []},
};

for (let i = 0; i < ITEM_COUNT; i++) {
    testJson.field3.push('item' + (i + 1));
    testJson.field4.key3.push('key' + (i + 1));
}

const jsonFieldSchema = BufferPlus.createSchema('JsonField');
jsonFieldSchema.addField('key1', 'string');
jsonFieldSchema.addField('key2', 'uint32le');
jsonFieldSchema.addArrayField('key3', 'string');
jsonFieldSchema.buildOnce();

// const testSchema = BufferPlus.createSchema('test');
// testSchema.addField('field1', 'uint32le');
// testSchema.addField('field2', 'string');
// testSchema.addArrayField('field3', 'string');
// testSchema.addField('field4', jsonFieldSchema);
// testSchema.build();
const testSchema = BufferPlus.createSchema('test', {
    type: 'object',
    properties: {
        field1: {type: 'uint32le'},
        field2: {type: 'string'},
        field3: {type: 'array', items: {type: 'string'}},
        field4: {type: 'schema', name: 'JsonField'},
    },
    order: ['field1', 'field2', 'field3', 'field4'],
});
testSchema.buildOnce();

const spSchema = sp.build({
    field1: 'uint32',
    field2: 'string',
    field3: ['string'],
    field4: {key1: 'string', key2: 'uint32', key3: ['string']},
});


const suite = new Benchmark.Suite();


const gp = {
    offset: 0,
    allocUnsafe: Buffer.allocUnsafe,
    writeVarUInt: writeVarUInt,
    writeString: writeString,
};

function writeVarUInt(value, buffer) {
    while (value >= 2147483648) { // value >= 2^31
        buffer[gp.offset++] = (value & 0xFF) | 0x80;
        value /= 128;
    }

    while (value > 127) {
        buffer[gp.offset++] = (value & 0xFF) | 0x80;
        value >>= 7;
    }
    buffer[gp.offset++] = value & 127;
}

function writeString(value, buffer) {
    const len = Buffer.byteLength(value, 'utf8');
    writeVarUInt(len, buffer);
    gp.offset += buffer.write(value, gp.offset, len, 'utf8');
}

function nativeBufferWrite(json) {
    const ref2 = json;
    const ref3 = ref2.field3;
    const ref4 = ref2.field4;
    const ref5 = ref4.key3;

    const wBuffer = gp.allocUnsafe(1317);
    gp.offset = 0;

    gp.offset = wBuffer.writeUInt32BE(ref2.field1, gp.offset, true);

    gp.writeString(ref2.field2, wBuffer);

    gp.writeVarUInt(ref3.length, wBuffer);
    for (let i = 0; i < ref3.length; i++) {
        gp.writeString(ref3[i], wBuffer);
    }


    gp.writeString(ref4.key1, wBuffer);

    gp.offset = wBuffer.writeUInt32BE(ref4.key2, gp.offset, true);

    gp.writeVarUInt(wBuffer, ref5.length);
    for (let j = 0; j < ref5.length; j++) {
        gp.writeString(ref5[j], wBuffer);
    }

    return wBuffer;
}

function nativeBpWrite(json) {
    bp.reset();

    // if (!testJson instanceof Object) throw new TypeError("Invalid json data for encoder");
    const strEnc = 'utf8';
    bp.writeUInt32BE(json.field1);
    bp.writePackedString(json.field2, strEnc);

    bp.writeVarUInt(json.field3.length);
    const field3Len = json.field3.length;
    for (let field3Iter = 0; field3Iter < field3Len; field3Iter++) {
        bp.writePackedString(json.field3[field3Iter], strEnc);
    }

    const field4 = json.field4;
    bp.writePackedString(field4.key1, strEnc);
    bp.writeUInt32BE(field4.key2.field1);

    bp.writeVarUInt(field4.key3.length);
    const key3Len = field4.key3.length;
    for (let j = 0; j < key3Len; j++) {
        bp.writePackedString(field4.key3[j], strEnc);
    }
}

suite
.add('BP Schema', () => {
    bp.reset();
    testSchema.encode(bp, testJson);
})
.add('Schemapack', () => {
    spSchema.encode(testJson);
    // const data = schemaRaw(schemaJson, gp);
    // console.log('data.legnth:' + data.length);
})
.add('Native Buffer', () => {
    // const data = schemaRawFunc(testJson, gp);
    nativeBufferWrite(testJson);
})
.add('Native BP', () => {
    nativeBpWrite(testJson);
})
;

suite.on('start', () => {
    console.log('on start');
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
