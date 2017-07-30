require('chai').should();
const BufferPlus = require('../src/index.js');

describe('Class methods', function() {
    it('#alloc', function() {
        let bp = BufferPlus.alloc(1024, 0);
        bp.size.should.equal(1024);
        bp.length.should.equal(0);
    });

    it('#allocUnsafe', function () {
        let bp = BufferPlus.allocUnsafe(1024);
        bp.size.should.equal(1024);
        bp.length.should.equal(0);
    });

    describe('#from', function() {
        it('(Buffer)', function() {
            const buf = Buffer.allocUnsafe(1024);
            const bp = BufferPlus.from(buf);
            bp.size.should.equal(1024);
            bp.length.should.equal(1024);

            Buffer.compare(buf, bp.toBuffer()).should.equal(0);
        });

        it('(Array)', function() {
            const array = [1, 2, 3, 4];
            const bp = BufferPlus.from(array);
            bp.size.should.equal(4);
            bp.length.should.equal(4);

            toArray(bp.toBuffer().values()).should.have.ordered.members(array);
        });
    });

});


describe('Basic', function() {

    describe('#moveTo', function () {
        it('inside boundary', function() {
            const bp = BufferPlus.from([1,2,3,4]);
            (function() {
                bp.moveTo(3);
            })
            .should.not.throw(RangeError);
            bp.position.should.equal(3);
        });

        it('outside boundary', function() {
            const bp = BufferPlus.from([1,2,3,4]);
            (function() {
                bp.moveTo(5);
            })
            .should.throw(RangeError);
        });
    });

    describe('#skip', function () {
        it('inside boundary', function() {
            const bp = BufferPlus.from([1,2,3,4,5,6]);
            bp.moveTo(2);
            (function() {
                bp.skip(3);
            })
            .should.not.throw(RangeError);
            bp.position.should.equal(5);
        });

        it('outside boundary', function() {
            const bp = BufferPlus.from([1,2,3,4,5,6]);
            bp.moveTo(2);
            (function() {
                bp.skip(5);
            })
            .should.throw(RangeError);
        });
    });

    describe('#rewind', function () {
        it('inside boundary', function() {
            const bp = BufferPlus.from([1,2,3,4,5,6]);
            bp.moveTo(5);
            (function() {
                bp.rewind(3);
            })
            .should.not.throw(RangeError);
            bp.position.should.equal(2);
        });

        it('outside boundary', function() {
            const bp = BufferPlus.from([1,2,3,4,5,6]);
            bp.moveTo(5);
            (function() {
                bp.rewind(6);
            })
            .should.throw(RangeError);
        });
    });

    it('#seal', function() {
        const testStr = 'test';
        const bp = BufferPlus.allocUnsafe(16);
        bp.writeString(testStr);
        bp.seal();
        bp.should.have.lengthOf(testStr.length);
    });

    it('#remaining', function() {
        const bp = BufferPlus.from(Buffer.from(new Array(16)));
        bp.should.have.lengthOf(16);
        bp.writeUInt32LE(0xffff);
        bp.position.should.equal(4);
        bp.remaining().should.equal(16 - 4);

        bp.writeUInt32LE(0xffff, 0);
        bp.should.have.lengthOf(20);
        bp.position.should.equal(8);
        bp.remaining().should.equal(16 - 4);
    });

    it('#toString', function() {
        const testStr = 'test string';
        const bp = BufferPlus.from(testStr);
        bp.toString().should.equal(testStr);
    });


    it('#toBuffer', function() {
        const jsonObj = {
            type: 0xf1,
            message: 'test json object',
            items: ['item1', 'item2']
        };
        const jsonStr = JSON.stringify(jsonObj);
        const bp = BufferPlus.from(jsonStr);
        bp.writeUInt32BE(jsonStr.length, 0);

        const newBp = BufferPlus.from(bp.toBuffer());
        newBp.readUInt32BE().should.equal(jsonStr.length);
        JSON.parse(newBp.readString(jsonStr.length)).should.deep.equal(jsonObj);
    });

});

describe('Read/Write', function() {
    describe('#String', function() {
        it('auto', function() {
            const testStr = 'test';
            const bp = BufferPlus.allocUnsafe(1);
            bp.writeString(testStr);
            bp.should.have.lengthOf(testStr.length);

            bp.moveTo(0);
            const str = bp.readString(testStr.length);
            str.should.equal(testStr);
        });

        it('insert', function() {
            const testStr = 'test';
            const bp = BufferPlus.allocUnsafe(32);
            bp.writeString(testStr, 6);
            bp.should.have.lengthOf(testStr.length + 6);

            bp.moveTo(1);
            bp.writeString(testStr);
            bp.should.have.lengthOf(testStr.length + 6);
            bp.moveTo(6);
            const str = bp.readString(testStr.length);
            str.should.equal(testStr);
        });
    });

    describe('#Buffer', function() {
        it('auto', function() {
            const testBuf = Buffer.from([0, 1, 2, 3, 4, 5, 6]);
            const bp = BufferPlus.allocUnsafe(1);
            bp.writeBuffer(testBuf);
            bp.should.have.lengthOf(testBuf.length);

            bp.moveTo(0);
            bp.readBuffer(testBuf.length).should.deep.equal(testBuf);
        });

        it('insert', function() {
            const testBuf = Buffer.from([0, 1, 2, 3, 4, 5, 6]);
            const bp = BufferPlus.allocUnsafe(1);
            bp.writeBuffer(testBuf, 6);
            bp.should.have.lengthOf(testBuf.length + 6);

            bp.moveTo(1);
            bp.writeString('test');
            bp.should.have.lengthOf(testBuf.length + 6);
            bp.moveTo(6);
            bp.readBuffer(testBuf.length).should.deep.equal(testBuf);
        });
    });

    describe('#Array', function() {
        it('auto', function() {
            const testStringItems = [];
            const testIntItems = [];

            for (let i = 0; i < 1000; i++)
                testStringItems.push('item' + i);

            for (let i = 0; i < 1000; i++)
                testIntItems.push(i);

            const bp = BufferPlus.allocUnsafe(1024);
            bp.writeArray(testStringItems, 'String');
            bp.writeArray(testIntItems, 'uint32be');

            bp.moveTo(0);
            bp.readArray('String').should.deep.equal(testStringItems);
            bp.readArray('UINT32BE').should.deep.equal(testIntItems);
        });

        it('insert', function() {
            const testStringItems = [];
            const testIntItems = [];

            for (let i = 0; i < 1000; i++)
                testStringItems.push('item' + i);

            for (let i = 0; i < 1000; i++)
                testIntItems.push(i);

            const bp = BufferPlus.allocUnsafe(1024);
            bp.writeArray(testStringItems, 'String');
            bp.writeArray(testIntItems, 'uint32be', 0);

            bp.moveTo(0);
            bp.readArray('UINT32BE').should.deep.equal(testIntItems);
            bp.readArray('String').should.deep.equal(testStringItems);
        });
    });

    describe('#Int8', function() {
        it('auto', function() { testNumberAuto('Int8'); });
        it('insert', function() { testNumberInsert('Int8'); });
    });
    describe('#Int16BE', function() {
        it('auto', function() { testNumberAuto('Int16BE'); });
        it('insert', function() { testNumberInsert('Int16BE'); });
    });
    describe('#Int16LE', function() {
        it('auto', function() { testNumberAuto('Int16LE'); });
        it('insert', function() { testNumberInsert('Int16LE'); });
    });
    describe('#Int32BE', function() {
        it('auto', function() { testNumberAuto('Int32BE'); });
        it('insert', function() { testNumberInsert('Int32BE'); });
    });
    describe('#Int32LE', function() {
        it('auto', function() { testNumberAuto('Int32LE'); });
        it('insert', function() { testNumberInsert('Int32LE'); });
    });
    describe('#Int64BE', function() {
        it('auto', function() { testNumberAuto('Int64BE'); });
        it('insert', function() { testNumberInsert('Int64BE'); });
    });
    describe('#Int64LE', function() {
        it('auto', function() { testNumberAuto('Int64LE'); });
        it('insert', function() { testNumberInsert('Int64LE'); });
    });


    describe('#UInt8', function() {
        it('auto', function() { testNumberAuto('UInt8'); });
        it('insert', function() { testNumberInsert('UInt8'); });
    });
    describe('#UInt16BE', function() {
        it('auto', function() { testNumberAuto('UInt16BE'); });
        it('insert', function() { testNumberInsert('UInt16BE'); });
    });
    describe('#UInt16LE', function() {
        it('auto', function() { testNumberAuto('UInt16LE'); });
        it('insert', function() { testNumberInsert('UInt16LE'); });
    });
    describe('#UInt32BE', function() {
        it('auto', function() { testNumberAuto('UInt32BE'); });
        it('insert', function() { testNumberInsert('UInt32BE'); });
    });
    describe('#UInt32LE', function() {
        it('auto', function() { testNumberAuto('UInt32LE'); });
        it('insert', function() { testNumberInsert('UInt32LE'); });
    });
    describe('#UInt64BE', function() {
        it('auto', function() { testNumberAuto('UInt64BE'); });
        it('insert', function() { testNumberInsert('UInt64BE'); });
    });
    describe('#UInt64LE', function() {
        it('auto', function() { testNumberAuto('UInt64LE'); });
        it('insert', function() { testNumberInsert('UInt64LE'); });
    });


    describe('#Int8Direct', function() {
        it('auto', function() { testNumberAuto('Int8Direct'); });
    });
    describe('#Int16BEDirect', function() {
        it('auto', function() { testNumberAuto('Int16BEDirect'); });
    });
    describe('#Int16LEDirect', function() {
        it('auto', function() { testNumberAuto('Int16LEDirect'); });
    });
    describe('#Int32BEDirect', function() {
        it('auto', function() { testNumberAuto('Int32BEDirect'); });
    });
    describe('#Int32LEDirect', function() {
        it('auto', function() { testNumberAuto('Int32LEDirect'); });
    });
    describe('#Int64BEDirect', function() {
        it('auto', function() { testNumberAuto('Int64BEDirect'); });
    });
    describe('#Int64LEDirect', function() {
        it('auto', function() { testNumberAuto('Int64LEDirect'); });
    });


    describe('#UInt8Direct', function() {
        it('auto', function() { testNumberAuto('UInt8Direct'); });
    });
    describe('#UInt16BEDirect', function() {
        it('auto', function() { testNumberAuto('UInt16BEDirect'); });
    });
    describe('#UInt16LEDirect', function() {
        it('auto', function() { testNumberAuto('UInt16LEDirect'); });
    });
    describe('#UInt32BEDirect', function() {
        it('auto', function() { testNumberAuto('UInt32BEDirect'); });
    });
    describe('#UInt32LEDirect', function() {
        it('auto', function() { testNumberAuto('UInt32LEDirect'); });
    });
    describe('#UInt64BEDirect', function() {
        it('auto', function() { testNumberAuto('UInt64BEDirect'); });
    });
    describe('#UInt64LEDirect', function() {
        it('auto', function() { testNumberAuto('UInt64LEDirect'); });
    });


    // Variable Integers
    describe('#VarUInt', function() {
        it('auto', function() {
            const bp = BufferPlus.allocUnsafe(64);
            bp.writeVarUInt(0xFF);
            bp.writeVarUInt(0xFFFF);
            bp.writeVarUInt(0xFFFFFFFF);
            bp.writeVarUInt(Number.MAX_SAFE_INTEGER);

            bp.moveTo(0);
            bp.readVarUInt().should.equal(0xFF);
            bp.readVarUInt().should.equal(0xFFFF);
            bp.readVarUInt().should.equal(0xFFFFFFFF);
            bp.readVarUInt().should.equal(Number.MAX_SAFE_INTEGER);
        });

        it('insert', function() {
            const bp = BufferPlus.allocUnsafe(64);

            bp.writeVarUInt(0xFF, 10);
            bp.writeVarUInt(0xFFFF, 10);
            bp.writeVarUInt(0xFFFFFFFF, 10);
            bp.writeVarUInt(Number.MAX_SAFE_INTEGER, 10);

            bp.moveTo(10);
            bp.readVarUInt().should.equal(Number.MAX_SAFE_INTEGER);
            bp.readVarUInt().should.equal(0xFFFFFFFF);
            bp.readVarUInt().should.equal(0xFFFF);
            bp.readVarUInt().should.equal(0xFF);

        });
    });

    describe('#VarInt', function() {
        it('auto', function() {
            const bp = BufferPlus.allocUnsafe(64);
            bp.writeVarInt(127);
            bp.writeVarInt(-128);
            bp.writeVarInt(32767);
            bp.writeVarInt(-32768);
            bp.writeVarInt(Number.MAX_SAFE_INTEGER);
            bp.writeVarInt(Math.floor(Number.MIN_SAFE_INTEGER / 2));

            bp.moveTo(0);
            bp.readVarInt().should.equal(127);
            bp.readVarInt().should.equal(-128);
            bp.readVarInt().should.equal(32767);
            bp.readVarInt().should.equal(-32768);
            bp.readVarInt().should.equal(Number.MAX_SAFE_INTEGER);
            bp.readVarInt().should.equal(Math.floor(Number.MIN_SAFE_INTEGER / 2));
        });

        it('insert', function() {
            const bp = BufferPlus.allocUnsafe(64);
            bp.writeVarInt(127, 10);
            bp.writeVarInt(-128, 10);
            bp.writeVarInt(32767, 10);
            bp.writeVarInt(-32768, 10);
            bp.writeVarInt(Number.MAX_SAFE_INTEGER, 10);
            bp.writeVarInt(Math.floor(Number.MIN_SAFE_INTEGER / 2), 10);

            bp.moveTo(10);
            bp.readVarInt().should.equal(Math.floor(Number.MIN_SAFE_INTEGER / 2));
            bp.readVarInt().should.equal(Number.MAX_SAFE_INTEGER);
            bp.readVarInt().should.equal(-32768);
            bp.readVarInt().should.equal(32767);
            bp.readVarInt().should.equal(-128);
            bp.readVarInt().should.equal(127);
        });
    });
});



const BufferPlusClass = BufferPlus.Buffer;
const WRITE_FUNC_MAP = {
    Int8: {size: 1, value: Math.floor((0xFF / 2) - 1)},
    Int16LE: {size: 2, value: Math.floor((0xFFFF / 2) - 1)},
    Int16BE: {size: 2, value: Math.floor((0xFFFF / 2) - 1)},
    Int32LE: {size: 4, value: Math.floor((0xFFFFFFFF / 2) - 1)},
    Int32BE: {size: 4, value: Math.floor((0xFFFFFFFF / 2) - 1)},
    Int64LE: {size: 8, value: Number.MAX_SAFE_INTEGER},
    Int64BE: {size: 8, value: Number.MAX_SAFE_INTEGER},

    UInt8: {size: 1, value: 0xFF},
    UInt16LE: {size: 2, value: 0xFFFF},
    UInt16BE: {size: 2, value: 0xFFFF},
    UInt32LE: {size: 4, value: 0xFFFFFFFF},
    UInt32BE: {size: 4, value: 0xFFFFFFFF},
    UInt64LE: {size: 8, value: Number.MAX_SAFE_INTEGER},
    UInt64BE: {size: 8, value: Number.MAX_SAFE_INTEGER},

    Int8Direct: {size: 1, value: Math.floor((0xFF / 2) - 1)},
    Int16LEDirect: {size: 2, value: Math.floor((0xFFFF / 2) - 1)},
    Int16BEDirect: {size: 2, value: Math.floor((0xFFFF / 2) - 1)},
    Int32LEDirect: {size: 4, value: Math.floor((0xFFFFFFFF / 2) - 1)},
    Int32BEDirect: {size: 4, value: Math.floor((0xFFFFFFFF / 2) - 1)},
    Int64LEDirect: {size: 8, value: Number.MAX_SAFE_INTEGER},
    Int64BEDirect: {size: 8, value: Number.MAX_SAFE_INTEGER},

    UInt8Direct: {size: 1, value: 0xFF},
    UInt16LEDirect: {size: 2, value: 0xFFFF},
    UInt16BEDirect: {size: 2, value: 0xFFFF},
    UInt32LEDirect: {size: 4, value: 0xFFFFFFFF},
    UInt32BEDirect: {size: 4, value: 0xFFFFFFFF},
    UInt64LEDirect: {size: 8, value: Number.MAX_SAFE_INTEGER},
    UInt64BEDirect: {size: 8, value: Number.MAX_SAFE_INTEGER},

};

function toArray(iterator)
{
    let array = [];
    for (let val of iterator)
        array.push(val);
    return array;
}

function getFunc(type)
{
    let func = WRITE_FUNC_MAP[type];
    func.read = BufferPlusClass.prototype[`read${type}`];
    func.write = BufferPlusClass.prototype[`write${type}`];
    return func;
}

function testNumberAuto(type)
{
    const func = getFunc(type);
    const bp = BufferPlus.allocUnsafe(32);
    func.write.call(bp, func.value);
    bp.position.should.equal(func.size);
    bp.moveTo(0);
    const readValue = func.read.call(bp);
    readValue.should.equal(func.value);
}

function testNumberInsert(type)
{
    const func = getFunc(type);
    const bp = BufferPlus.allocUnsafe(32);
    func.write.call(bp, func.value, 4);
    func.write.call(bp, func.value - 1, 4);
    bp.length.should.equal(4 + func.size * 2);
    bp.moveTo(4);
    func.read.call(bp).should.equal(func.value - 1);
    func.read.call(bp).should.equal(func.value);
}