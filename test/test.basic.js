require('chai').should();
const BufferPlus = require('../lib/index.js');

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

    FloatBE: {size: 4, value: parseFloat('3.40282e-38')},
    FloatLE: {size: 4, value: parseFloat('3.40282e-38')},
    DoubleBE: {size: 8, value: parseFloat('3.40282e-38')},
    DoubleLE: {size: 8, value: parseFloat('3.40282e-38')},
};

function toArray(iterator) {
    const array = [];
    for (const val of iterator) {
        array.push(val);
    }
    return array;
}

function getFunc(type) {
    const func = WRITE_FUNC_MAP[type];
    func.read = BufferPlusClass.prototype[`read${type}`];
    func.write = BufferPlusClass.prototype[`write${type}`];
    return func;
}

function testNumberAuto(type) {
    const func = getFunc(type);
    const bp = BufferPlus.allocUnsafe(32);
    func.write.call(bp, func.value);
    bp.position.should.equal(func.size);
    bp.moveTo(0);
    const readValue = func.read.call(bp);
    if (type.startsWith('Float') || type.startsWith('Double')) {
        readValue.should.closeTo(func.value, 0.0001);
    } else {
        readValue.should.equal(func.value);
    }
}

function testNumberInsert(type) {
    const func = getFunc(type);
    const bp = BufferPlus.allocUnsafe(32);
    func.write.call(bp, func.value, 4);
    func.write.call(bp, func.value - 1, 4);
    bp.length.should.equal(4 + (func.size * 2));
    bp.moveTo(4);

    if (type.startsWith('Float') || type.startsWith('Double')) {
        func.read.call(bp).should.closeTo(func.value - 1, 0.0001);
        func.read.call(bp).should.closeTo(func.value, 0.0001);
    } else {
        func.read.call(bp).should.equal(func.value - 1);
        func.read.call(bp).should.equal(func.value);
    }
}


describe('Class methods', () => {
    it('#create', () => {
        const bp = BufferPlus.create();
        bp.length.should.equal(0);
        bp.position.should.equal(0);
        bp.size.should.not.equal(0);

        const testStr = 'test string';
        const rawBuf = Buffer.alloc(Buffer.byteLength(testStr));

        const bp2 = BufferPlus.create(rawBuf);
        bp2.writeString(testStr, 'utf8');

        rawBuf.toString('utf8', 0, Buffer.byteLength(testStr)).should.equal(testStr);

        const bp3 = BufferPlus.create(1024);
        bp3.size.should.equal(1024);

        (() => {
            BufferPlus.create('string');
        }).should.throw(TypeError);

        (() => {
            BufferPlus.create(-1);
        }).should.throw(RangeError);
    });

    it('#alloc', () => {
        const bp = BufferPlus.alloc(1024, 0);
        bp.size.should.equal(1024);
        bp.length.should.equal(0);
        bp.position.should.equal(0);
    });

    it('#allocUnsafe', () => {
        const bp = BufferPlus.allocUnsafe(1024);
        bp.size.should.equal(1024);
        bp.length.should.equal(0);
        bp.position.should.equal(0);
    });

    it('#allocUnsafeSlow', () => {
        const bp = BufferPlus.allocUnsafeSlow(1024);
        bp.size.should.equal(1024);
        bp.length.should.equal(0);
        bp.position.should.equal(0);
    });

    describe('#from', () => {
        it('(Buffer)', () => {
            const buf = Buffer.allocUnsafe(1024);
            const bp = BufferPlus.from(buf);
            bp.size.should.equal(1024);
            bp.length.should.equal(1024);

            Buffer.compare(buf, bp.toBuffer()).should.equal(0);
            bp.toBuffer().should.deep.equal(buf);
            bp._buf.should.equal(buf);

            buf.writeUInt32LE(1000);
            bp.writeUInt32LE(2000);

            bp.moveTo(0);
            bp.readUInt32LE().should.equal(buf.readUInt32LE(0));
        });

        it('(Array)', () => {
            const array = [1, 2, 3, 4];
            const bp = BufferPlus.from(array);
            bp.size.should.equal(4);
            bp.length.should.equal(4);

            toArray(bp.toBuffer().values()).should.have.ordered.members(array);
        });
    });

    describe('#clone', () => {
        it('(Buffer)', () => {
            const buf = Buffer.allocUnsafe(1024);
            const bp = BufferPlus.clone(buf);
            bp.size.should.equal(1024);
            bp.length.should.equal(1024);

            Buffer.compare(buf, bp.toBuffer()).should.equal(0);
            bp.toBuffer().should.deep.equal(buf);
            bp.toBuffer().should.not.equal(buf);

            buf.writeUInt32LE(1000);
            bp.writeUInt32LE(2000);

            bp.moveTo(0);
            bp.readUInt32LE().should.not.equal(buf.readUInt32LE(0));
        });

        it('(Array)', () => {
            const array = [1, 2, 3, 4];
            const bp = BufferPlus.from(array);
            bp.size.should.equal(4);
            bp.length.should.equal(4);

            toArray(bp.toBuffer().values()).should.have.ordered.members(array);
        });
    });
});


describe('Basic', () => {
    describe('#moveTo', () => {
        it('inside boundary', () => {
            const bp = BufferPlus.from([1, 2, 3, 4]);
            (() => {
                bp.moveTo(3);
            })
            .should.not.throw(RangeError);
            bp.position.should.equal(3);
        });

        it('outside boundary', () => {
            const bp = BufferPlus.from([1, 2, 3, 4]);
            (() => {
                bp.moveTo(5);
            })
            .should.throw(RangeError);
        });

        it('force', () => {
            const bp = BufferPlus.create(64);
            (() => {
                bp.moveTo(3);
            })
            .should.throw(RangeError);

            (() => {
                bp.moveTo(3, true);
            })
            .should.not.throw(RangeError);

            bp.position.should.equal(3);
        });
    });

    describe('#skip', () => {
        it('inside boundary', () => {
            const bp = BufferPlus.from([1, 2, 3, 4, 5, 6]);
            bp.moveTo(2);
            (() => {
                bp.skip(3);
            })
            .should.not.throw(RangeError);
            bp.position.should.equal(5);
        });

        it('outside boundary', () => {
            const bp = BufferPlus.from([1, 2, 3, 4, 5, 6]);
            bp.moveTo(2);
            (() => {
                bp.skip(5);
            })
            .should.throw(RangeError);
        });

        it('force', () => {
            const bp = BufferPlus.create(64);
            bp.moveTo(2, true);
            (() => {
                bp.skip(3);
            })
            .should.throw(RangeError);

            (() => {
                bp.skip(3, true);
            })
            .should.not.throw(RangeError);

            bp.position.should.equal(5);
        });
    });

    describe('#rewind', () => {
        it('inside boundary', () => {
            const bp = BufferPlus.from([1, 2, 3, 4, 5, 6]);
            bp.moveTo(5);
            (() => {
                bp.rewind(3);
            })
            .should.not.throw(RangeError);
            bp.position.should.equal(2);
        });

        it('outside boundary', () => {
            const bp = BufferPlus.from([1, 2, 3, 4, 5, 6]);
            bp.moveTo(5);
            (() => {
                bp.rewind(6);
            })
            .should.throw(RangeError);
        });
    });

    it('#seal', () => {
        const testStr = 'test';
        const bp = BufferPlus.allocUnsafe(16);
        bp.writeString(testStr);
        bp.seal();
        bp.should.have.lengthOf(testStr.length);
    });

    it('#remaining', () => {
        const bp = BufferPlus.from(Buffer.from(new Array(16)));
        bp.should.have.lengthOf(16);
        bp.writeUInt32LE(0xffff);
        bp.position.should.equal(4);
        bp.remaining.should.equal(16 - 4);

        bp.writeUInt32LE(0xffff, 0);
        bp.should.have.lengthOf(20);
        bp.position.should.equal(8);
        bp.remaining.should.equal(16 - 4);
    });

    it('#toString', () => {
        const testStr = 'test string';
        const bp = BufferPlus.from(testStr);
        bp.toString().should.equal(testStr);
    });


    it('#toBuffer', () => {
        const jsonObj = {
            type: 0xf1,
            message: 'test json object',
            items: ['item1', 'item2'],
        };
        const jsonStr = JSON.stringify(jsonObj);
        const bp = BufferPlus.from(jsonStr);
        bp.writeUInt32BE(jsonStr.length, 0);

        const newBp = BufferPlus.from(bp.toBuffer());
        newBp.readUInt32BE().should.equal(jsonStr.length);
        JSON.parse(newBp.readString(jsonStr.length)).should.deep.equal(jsonObj);
    });
});

describe('Read/Write', () => {
    describe('#String', () => {
        it('auto', () => {
            const utf8Str = '中文測試 string';
            const asciiStr = 'ascii string test';
            const utf8StrBytes = BufferPlus.byteLength(utf8Str);
            const asciiStrBytes = BufferPlus.byteLength(asciiStr, 'ascii');

            const bp = BufferPlus.allocUnsafe(1);

            bp.writeString(utf8Str);
            bp.should.have.lengthOf(utf8StrBytes);

            bp.writeString(asciiStr, 'ascii');
            bp.should.have.lengthOf(utf8StrBytes + asciiStrBytes);

            bp.moveTo(0);
            bp.readString(utf8StrBytes, 'utf8').should.equal(utf8Str);
            bp.readString(asciiStrBytes, 'ascii').should.equal(asciiStr);
        });

        it('insert', () => {
            const utf8Str = '中文測試 string';
            const asciiStr = 'ascii string test';
            const utf8StrBytes = BufferPlus.byteLength(utf8Str);
            const asciiStrBytes = BufferPlus.byteLength(asciiStr, 'ascii');
            const bp = BufferPlus.allocUnsafe(32);

            // insert utf-8 string after ascii string first
            bp.writeString(utf8Str, asciiStrBytes, 'utf8');
            bp.should.have.lengthOf(utf8StrBytes + asciiStrBytes);

            bp.writeString(asciiStr, 'ascii');
            bp.should.have.lengthOf(utf8StrBytes + asciiStrBytes);

            bp.moveTo(0);
            bp.should.have.lengthOf(utf8StrBytes + asciiStrBytes);

            bp.readString(asciiStrBytes, 'ascii').should.equal(asciiStr);

            bp.moveTo(asciiStrBytes);
            bp.readString(utf8StrBytes).should.equal(utf8Str);
        });
    });

    describe('#Buffer', () => {
        it('auto', () => {
            const testBuf = Buffer.from([0, 1, 2, 3, 4, 5, 6]);
            const bp = BufferPlus.allocUnsafe(1);
            bp.writeBuffer(testBuf);
            bp.should.have.lengthOf(testBuf.length);

            bp.moveTo(0);
            bp.readBuffer(testBuf.length).should.deep.equal(testBuf);
        });

        it('insert', () => {
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

    describe('#Array', () => {
        it('auto', () => {
            const testStringItems = [];
            const testIntItems = [];

            for (let i = 0; i < 1000; i++) {
                testStringItems.push('item' + i);
            }

            for (let i = 0; i < 1000; i++) {
                testIntItems.push(i);
            }

            const bp = BufferPlus.allocUnsafe(1024);
            bp.writeArray(testStringItems, 'String');
            bp.writeArray(testIntItems, 'uint32be');

            bp.moveTo(0);
            bp.readArray('String').should.deep.equal(testStringItems);
            bp.readArray('UINT32BE').should.deep.equal(testIntItems);
        });

        it('insert', () => {
            const testStringItems = [];
            const testIntItems = [];

            for (let i = 0; i < 1000; i++) {
                testStringItems.push('item' + i);
            }

            for (let i = 0; i < 1000; i++) {
                testIntItems.push(i);
            }

            const bp = BufferPlus.allocUnsafe(1024);
            bp.writeArray(testStringItems, 'String');
            bp.writeArray(testIntItems, 'uint32be', 0);

            bp.moveTo(0);
            bp.readArray('UINT32BE').should.deep.equal(testIntItems);
            bp.readArray('String').should.deep.equal(testStringItems);
        });

        it('empty', () => {
            const bp = BufferPlus.allocUnsafe(32);
            bp.writeArray([], 'string');
            bp.moveTo(0);
            bp.readArray('string').should.deep.equal([]);
        });
    });

    describe('#Fixed Number', () => {
        it('auto', () => {
            const testTypes = [
                'Int8', 'UInt8',
                'Int16BE', 'UInt16LE',
                'Int32BE', 'UInt32LE',
                'Int64BE', 'UInt64LE',
                'FloatBE', 'FloatLE',
                'DoubleBE', 'DoubleLE',
            ];
            testTypes.forEach((type) => {
                testNumberAuto(type);
            });
        });
        it('insert', () => {
            const testTypes = [
                'Int8', 'UInt8',
                'Int16BE', 'UInt16LE',
                'Int32BE', 'UInt32LE',
                'Int64BE', 'UInt64LE',
                'FloatBE', 'FloatLE',
                'DoubleBE', 'DoubleLE',
            ];
            testTypes.forEach((type) => {
                testNumberInsert(type);
            });
        });
    });

    // Variable Integers
    describe('#VarUInt', () => {
        it('auto', () => {
            const testValues = [
                0xFF, 0xFFFF,
                0xFFFF, 0xFFFFFFFF,
                0xFFFF123, 0xFFFFFFFF123,
                Number.MAX_SAFE_INTEGER,
            ];
            const bp = BufferPlus.allocUnsafe(64);
            testValues.forEach((value) => {
                bp.writeVarInt(value);
            });

            let byteCount = 0;
            bp.moveTo(0);
            testValues.forEach((value) => {
                bp.readVarInt().should.equal(value);
                byteCount += BufferPlus.byteLengthVarInt(value);
                bp.position.should.equal(byteCount);
            });
        });

        it('insert', () => {
            const testValues = [
                0xFF, 0xFFFF,
                0xFFFF, 0xFFFFFFFF,
                0xFFFF123, 0xFFFFFFFF123,
                Number.MAX_SAFE_INTEGER,
            ];
            const bp = BufferPlus.allocUnsafe(64);

            testValues.forEach((value) => {
                bp.writeVarInt(value, 10);
            });

            let byteCount = 10;
            bp.moveTo(10);
            testValues.reverse().forEach((value) => {
                bp.readVarInt().should.equal(value);
                byteCount += BufferPlus.byteLengthVarInt(value);
                bp.position.should.equal(byteCount);
            });
        });
    });

    describe('#VarInt', () => {
        it('auto', () => {
            const testValues = [
                127, -128,
                32767, -32768,
                65535, -65536,
                4194304, -4194305,
                Number.MAX_SAFE_INTEGER,
                Math.floor(Number.MIN_SAFE_INTEGER / 2),
            ];
            const bp = BufferPlus.allocUnsafe(64);

            testValues.forEach((value) => {
                bp.writeVarInt(value);
            });

            let byteCount = 0;
            bp.moveTo(0);
            testValues.forEach((value) => {
                bp.readVarInt().should.equal(value);
                byteCount += BufferPlus.byteLengthVarInt(value);
                bp.position.should.equal(byteCount);
            });
        });

        it('insert', () => {
            const testValues = [
                127, -128,
                32767, -32768,
                65535, -65536,
                4194304, -4194305,
                Number.MAX_SAFE_INTEGER,
                Math.floor(Number.MIN_SAFE_INTEGER / 2),
            ];
            const bp = BufferPlus.allocUnsafe(64);

            testValues.forEach((value) => {
                bp.writeVarInt(value, 10);
            });

            let byteCount = 10;
            bp.moveTo(10);
            testValues.reverse().forEach((value) => {
                bp.readVarInt().should.equal(value);
                byteCount += BufferPlus.byteLengthVarInt(value);
                bp.position.should.equal(byteCount);
            });
        });
    });

    describe('#Chaining', () => {
        it('position', () => {
            const bp = BufferPlus.from(Buffer.allocUnsafe(64));
            bp.moveTo(20).rewind(20).position.should.equal(0);
            bp.moveTo(20).skip(20).rewind(40).position.should.equal(0);
        });
        it('read/write', () => {
            const bp = BufferPlus.create();
            bp.writeString('ab')
                .writeString('cd')
                .writeString('ef')
                .moveTo(0)
                .readString(6)
                .should.equal('abcdef');
            bp.reset();
            bp.writeUInt8(0xFF)
                .writeUInt16LE(0xFFFF)
                .writeUInt32LE(0xFFFFFFFF)
                .writeUInt64LE(Number.MAX_SAFE_INTEGER);
            bp.moveTo(0);
            bp.readUInt8().should.equal(0XFF);
            bp.readUInt16LE().should.equal(0xFFFF);
            bp.readUInt32LE().should.equal(0xFFFFFFFF);
            bp.readUInt64LE().should.equal(Number.MAX_SAFE_INTEGER);
        });
    });
});
