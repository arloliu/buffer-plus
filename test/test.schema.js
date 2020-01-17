require('chai').should();
const BufferPlus = require('../src/index.js');

const testHeader = {
    headerLen: 2000,
    name: 'test header',
    type: 0x8,
    isAdmin: false,
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
    isAdmin: true,
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

const testNestSchema = {
    user: {
        name: 'test',
        email: 'test@gmail.com',
        currentStatus: {group: 'health', msg: 'ok'},
    },
    accounts: [
        {
            name: 'test1',
            email: 'test1@gmail.com',
            currentStatus: {group: 'health', msg: 'ok'},
        },
        {
            name: 'test2',
            email: 'test2@gmail.com',
            currentStatus: {group: 'health', msg: 'ok'},
        },
    ],
};

const testComplexObject = {
    headerLen: 2000,
    name: 'test header',
    type: 0x8,
    isAdmin: true,
    serial: 0x123456781234567,
    source: {type: 'client', ip: '127.0.0.1'},
    customString: 'this is a custom string 1',
    customObject: {
        type: 0x3,
        message: 'test message 1',
        items: [0xfffffff1, 0xfffffff2, 0xfffffff3, 0xfffffff4],
    },
    customArray: [
        {
            type: 0x4,
            message: 'test message 2',
            items: [0xfffffff1, 0xfffffff2, 0xfffffff3, 0xfffffff4, 0xfffffff5],
        },
        {
            type: 0x5,
            message: 'test message 3',
            items: [0xfffffff1, 0xfffffff2, 0xfffffff3, 0xfffffff4],
        },
    ],
    customNestObject: {
        nest1: {
            type: 0x4,
            message: 'test message 2',
            items: [0xfffffff1, 0xfffffff2, 0xfffffff3, 0xfffffff4],
        },
        nest2: {
            type: 0x5,
            message: 'test message 3',
            items: [0xfffffff1, 0xfffffff2, 0xfffffff3, 0xfffffff4],
        },
    },
    account: {
        name: 'test',
        email: 'test@gmail.com',
        currentStatus: {
            group: 'test',
            msg: 'test group',
        },
    },
    locations: ['tw', 'us', 'jp'],
    languages: [['aa', 'bb', 'cc'], ['dd', 'ee'], ['ff', 'gg']],
    labels: [
        [['t11', 't12'], ['t13', 't14']],
        [['t21', 't22'], ['t23', 't24']],
        [['t31', 't32'], ['t33', 't34']],
    ],
    data: [
        {group: 'group1', name: '中文測試1', count: 5000},
        {group: 'group2', name: '中文測試2', count: 5001},
        {group: 'group3', name: '中文測試3', count: 0x123456789},
    ],
    info: {
        group: ['a1', 'a2'],
        memo: {
            name: 'test1',
            address: 'test2',
        },
    },
};

BufferPlus.createSchema('status', {
    type: 'object',
    properties: {
        group: {type: 'string'},
        msg: {type: 'string'},
    },
    order: ['group', 'msg'],
});

BufferPlus.createSchema('account', {
    type: 'object',
    properties: {
        name: {type: 'string'},
        email: {type: 'string'},
        currentStatus: {
            type: 'schema',
            name: 'status',
        },
    },
    order: ['name', 'email', 'currentStatus'],
});

const nestSchemaObjetSchema = {
    type: 'object',
    properties: {
        user: {
            type: 'schema',
            name: 'account',
        },
        accounts: {
            type: 'array',
            items: {
                type: 'schema',
                name: 'account',
            },
        },
    },
    order: ['user', 'accounts'],
};

const complextObjectSchema = {
    type: 'object',
    properties: {
        headerLen: {type: 'varuint'},
        name: {type: 'string'},
        type: {type: 'uint8'},
        isAdmin: {type: 'boolean'},
        serial: {type: 'uint64le'},
        source: {
            type: 'object',
            properties: {
                type: {type: 'string'},
                ip: {type: 'string'},
            },
            order: ['type', 'ip'],
        },
        customString: {
            type: 'custom',
            name: 'CustomString',
        },
        customObject: {
            type: 'custom',
            name: 'CustomObject',
        },
        customArray: {
            type: 'array',
            items: {
                type: 'custom',
                name: 'CustomObject',
            },
        },
        customNestObject: {
            type: 'object',
            properties: {
                nest1: {type: 'custom', name: 'CustomObject'},
                nest2: {type: 'custom', name: 'CustomObject'},
            },
            order: ['nest1', 'nest2'],
        },
        account: {
            type: 'schema',
            name: 'account',
        },
        locations: {
            type: 'array',
            items: {type: 'string'},
        },
        languages: {
            type: 'array',
            items: {
                type: 'array',
                items: {type: 'string'},
            },
        },
        labels: {
            type: 'array',
            items: {
                type: 'array',
                items: {
                    type: 'array',
                    items: {type: 'string'},
                },
            },
        },
        data: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    group: {type: 'string'},
                    name: {type: 'string'},
                    count: {type: 'varint'},
                },
                order: ['name', 'count', 'group'],
            },
        },
        info: {
            type: 'object',
            properties: {
                group: {
                    type: 'array',
                    items: {type: 'string'},
                },
                memo: {
                    type: 'object',
                    properties: {
                        name: {type: 'string'},
                        address: {type: 'string'},
                    },
                    order: ['name', 'address'],
                },
            },
            order: ['group', 'memo'],
        },
    },
    order: [
        'headerLen',
        'name',
        'type',
        'isAdmin',
        'serial',
        'source',
        'customString',
        'customObject',
        'customArray',
        'customNestObject',
        'account',
        'locations',
        'languages',
        'labels',
        'data',
        'info',
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

        BufferPlus.createSchema('ArrayTest', {
            type: 'object',
            properties: {
                item1: {
                    type: 'array',
                    items: {
                        type: 'boolean',
                    },
                },
                item2: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: {type: 'string'},
                        },
                        order: ['name'],
                    },
                },
            },
            order: ['item1', 'item2'],
        });
        BufferPlus.createSchema('NestSchema', nestSchemaObjetSchema);

        BufferPlus.createSchema('ComplexObject', complextObjectSchema);

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
        headerSchema.addField('isAdmin', 'boolean');
        headerSchema.addField('serial', 'uint64le');
        headerSchema.addField('source', BufferPlus.getSchema('Location'));
        headerSchema.addField('customString', 'CustomString');
        headerSchema.addField('customObject', 'CustomObject');
        headerSchema.addArrayField('items', BufferPlus.getSchema('Item'));
    });

    beforeEach(() => {
        bp.reset();
    });

    it('#Empty Array', () => {
        const empty1 = {
            item1: [],
            item2: [],
        };
        const empty2 = {
            item1: [],
            item2: [{name: 'test'}],
        };
        bp.writeSchema('ArrayTest', empty1);
        bp.writeSchema('ArrayTest', empty2);

        const decodeBuf = BufferPlus.from(bp);
        decodeBuf.readSchema('ArrayTest').should.deep.equal(empty1);
        decodeBuf.readSchema('ArrayTest').should.deep.equal(empty2);
    });

    it('#NestSchema', () => {
        let offset = 0;
        bp.writeSchema('NestSchema', testNestSchema);
        offset += BufferPlus.byteLengthSchema('NestSchema', testNestSchema);
        bp.length.should.equal(offset);

        const decodeBuf = BufferPlus.from(bp);
        decodeBuf.readSchema('NestSchema').should.deep.equal(testNestSchema);
    });

    it('#Header(auto)', () => {
        let offset = 0;

        bp.writeSchema('Header', testHeader);
        offset += BufferPlus.byteLengthSchema('Header', testHeader);
        bp.length.should.equal(offset);

        bp.writeSchema('Header', testHeader2);
        offset += BufferPlus.byteLengthSchema('Header', testHeader2);
        bp.length.should.equal(offset);

        bp.writeSchema('ComplexObject', testComplexObject);
        offset += BufferPlus.byteLengthSchema('ComplexObject', testComplexObject);
        bp.length.should.equal(offset);

        const decodeBuf = BufferPlus.from(bp);
        decodeBuf.readSchema('Header').should.deep.equal(testHeader);
        decodeBuf.readSchema('Header').should.deep.equal(testHeader2);
        decodeBuf.readSchema('ComplexObject').should.deep.equal(testComplexObject);
    });

    it('#Header(insert)', () => {
        const testStr = 'test string';
        bp.writePackedString(testStr);
        bp.writeSchema('Header', testHeader, 0);
        bp.writeSchema('ComplexObject', testComplexObject, 0);
        bp.length.should.equal(
            BufferPlus.byteLengthPackedString(testStr)
            + BufferPlus.getSchema('Header').byteLength(testHeader)
            + BufferPlus.getSchema('ComplexObject').byteLength(testComplexObject)
        );


        const decodeBuf = BufferPlus.from(bp);
        const result1 = decodeBuf.readSchema('ComplexObject');
        const result2 = decodeBuf.readSchema('Header');
        result1.should.deep.equal(testComplexObject);
        result2.should.deep.equal(testHeader);

        decodeBuf.readPackedString().should.equal(testStr);
    });
});
