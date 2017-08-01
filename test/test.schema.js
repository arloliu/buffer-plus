require('chai').should();
const BufferPlus = require('../src/index.js');

const testHeader = {
    headerLen: 2000,
    name: 'test header',
    type: 0x8,
    serial: 0x123456781234567,
    source: {type: 'client', ip: '127.0.0.1'},
    items: [
        {group: 'group1', name: '中文測試1', count: 5000},
        {group: 'group2', name: '中文測試2', count: 5001},
        {group: 'group3', name: '中文測試3', count: 0x123456789},
    ]
};

describe('Custom. Schema', function() {
    const bp = BufferPlus.allocUnsafe(1024);

    before(function() {
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
        headerSchema.addArrayField('items', BufferPlus.getSchema('Item'));

    });

    beforeEach(function() {
        bp.reset();
    });

    it('#Header(auto)', function() {

        bp.writeSchema('Header', testHeader);
        bp.length.should.equal(BufferPlus.getSchema('Header').byteLength(testHeader));
        const decodeBuf = BufferPlus.from(bp);

        const result = decodeBuf.readSchema('Header');
        result.should.deep.equal(testHeader);
    });

    it('#Header(insert)', function() {
        const testStr = 'test string';
        bp.writePackedString(testStr);
        bp.writeSchema('Header', testHeader, 0);
        bp.length.should.equal(bp.byteLengthPackedString(testStr) + BufferPlus.getSchema('Header').byteLength(testHeader));


        const decodeBuf = BufferPlus.from(bp);
        const result = decodeBuf.readSchema('Header');
        result.should.deep.equal(testHeader);

        decodeBuf.readPackedString().should.equal(testStr);
    });

});
