require('chai').should();
const BufferPlus = require('../src/index.js');

const testHeader = {
    headerLen: 2000,
    name: 'test header',
    type: 0x8,
    serial: 0x123456781234567,
    source: {type: 'client', ip: '127.0.0.1'},
    customString: 'this is a custom string 1',
    customObject: {
        type: 0x3,
        message: 'test message 1',
        items: [0xfffffff1, 0xfffffff2, 0xfffffff3, 0xfffffff4],
    },
    items: [
        {group: 'group1', name: '中文測試1', count: 5000},
        {group: 'group2', name: '中文測試2', count: 5001},
        {group: 'group3', name: '中文測試3', count: 0x123456789},
    ],
};

const testHeader2 = {
    headerLen: 3000,
    name: 'test header2',
    type: 0x8,
    serial: 0xa23b567812345f7,
    source: {type: 'client', ip: '192.168.0.1'},
    customString: 'this is a custom string 2',
    customObject: {
        type: 0x8,
        message: 'test message 2',
        items: [0xfffffff1, 0xfffffff2, 0xfffffff3, 0xfffffff4],
    },
    items: [
        {group: 'group1', name: '中文測試1', count: 4000},
        {group: 'group2', name: '中文測試2', count: 4001},
        {group: 'group3', name: '中文測試3', count: 0xa23456f89},
    ],
};

describe('Custom. Schema', () => {
    const bp = BufferPlus.allocUnsafe(1024);

    before(() => {
        BufferPlus.addCustomType('CustomString',
                (buffer) => {
                    const len = buffer.readVarUInt();
                    return buffer.readString(len);
                },
                (buffer, value) => {
                buffer.writeVarUInt(value.length);
                buffer.writeString(value);
                },
                (value) => {
                    return BufferPlus.byteLengthVarUInt(value.length)
                    + BufferPlus.byteLength(value);
                }
        );

        BufferPlus.addCustomType('CustomObject',
                (buffer) => {
                    const obj = {};
                obj.type = buffer.readUInt8();
                obj.message = buffer.readCustomString();
                obj.items = buffer.readArray('uint32le');
                return obj;
                },
                (buffer, value) => {
                buffer.writeUInt8(value.type);
                buffer.writeCustomString(value.message);
                buffer.writeArray(value.items, 'uint32le');
                },
                (value) => {
                    return 1
                    + BufferPlus.byteLengthCustomString(value.message)
                    + BufferPlus.byteLengthArray(value.items, 'uint32le');
                }
        );


        const locationSchema = BufferPlus.createSchema('Location');
        locationSchema.addField('type', 'string');
        locationSchema.addField('ip', 'string');

        const itemSchema = BufferPlus.createSchema('Item');
        itemSchema.addField('group', 'string');
        itemSchema.addField('count', 'varint');
        itemSchema.addField('name', 'string');

        const headerSchema = BufferPlus.createSchema('Header');

        headerSchema.addField('headerLen', 'varuint');
        headerSchema.addField('name', 'string');
        headerSchema.addField('type', 'uint8');
        headerSchema.addField('serial', 'uint64le');
        headerSchema.addField('source', BufferPlus.getSchema('Location'));
        headerSchema.addField('customString', 'CustomString');
        headerSchema.addField('customObject', 'CustomObject');
        headerSchema.addArrayField('items', BufferPlus.getSchema('Item'));
    });

    beforeEach(() => {
        bp.reset();
    });

    it('#Header(auto)', () => {
        let offset = 0;
        bp.writeSchema('Header', testHeader);
        offset += BufferPlus.byteLengthSchema('Header', testHeader);
        bp.length.should.equal(offset);

        bp.writeSchema('Header', testHeader2);
        offset += BufferPlus.byteLengthSchema('Header', testHeader2);
        bp.length.should.equal(offset);

        const decodeBuf = BufferPlus.from(bp);
        decodeBuf.readSchema('Header').should.deep.equal(testHeader);
        decodeBuf.readSchema('Header').should.deep.equal(testHeader2);
    });

    it('#Header(insert)', () => {
        const testStr = 'test string';
        bp.writePackedString(testStr);
        bp.writeSchema('Header', testHeader, 0);
        bp.length.should.equal(
            BufferPlus.byteLengthPackedString(testStr)
            + BufferPlus.getSchema('Header').byteLength(testHeader)
        );


        const decodeBuf = BufferPlus.from(bp);
        const result = decodeBuf.readSchema('Header');
        result.should.deep.equal(testHeader);

        decodeBuf.readPackedString().should.equal(testStr);
    });
});
