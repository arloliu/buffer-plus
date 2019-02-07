require('chai').should();
const BufferPlus = require('../src/index.js');

describe('Custom. Type', () => {
    const bp = BufferPlus.allocUnsafe(1);

    beforeEach(() => {
        bp.reset();
    });

    before(() => {
        BufferPlus.addCustomType('HeaderString',
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

        BufferPlus.addCustomType('Header',
                (buffer) => {
                    const obj = {};
                    obj.type = buffer.readUInt8();
                    obj.message = buffer.readHeaderString();
                    obj.items = buffer.readArray('uint32le');
                    return obj;
                },
                (buffer, value) => {
                    buffer.writeUInt8(value.type);
                    buffer.writeHeaderString(value.message);
                    buffer.writeArray(value.items, 'uint32le');
                },
                (value) => {
                    return 1
                        + BufferPlus.byteLengthHeaderString(value.message)
                        + BufferPlus.byteLengthArray(value.items, 'uint32le');
                }
        );
    });


    it('#byteLength', () => {
        const testStr = 'header string';
        const testStrSize = BufferPlus.byteLengthHeaderString(testStr);
        bp.writeHeaderString(testStr);
        bp.position.should.equal(testStrSize);
    });

    it('#basic', () => {
        const testStr = 'header string';
        const testStr2 = 'header string2';
        const testStrSize = BufferPlus.byteLengthHeaderString(testStr);
        bp.writeUInt32LE(testStrSize);
        bp.writeHeaderString(testStr);
        bp.writeHeaderString(testStr2);

        bp.moveTo(0);
        bp.readUInt32LE().should.equal(testStrSize);
        bp.readHeaderString().should.equal(testStr);
        bp.readHeaderString().should.equal(testStr2);
    });

    it('#addCustomType', () => {
        (() => {
            BufferPlus.addCustomType('-invalidname', () => {}, () => {}, () => {});
        }).should.throw(TypeError);

        (() => {
            BufferPlus.addCustomType('invalid!name', () => {}, () => {}, () => {});
        }).should.throw(TypeError);

        (() => {
            BufferPlus.addCustomType('invalid-Name', () => {}, () => {}, () => {});
        }).should.throw(TypeError);

        (() => {
            BufferPlus.addCustomType('validName__', () => {}, () => {}, () => {});
        }).should.not.throw(TypeError);

        (() => {
            BufferPlus.addCustomType('$valid_name', () => {}, () => {}, () => {});
        }).should.not.throw(TypeError);
    });

    it('#compound', () => {
        const header = {
            type: 0x8,
            message: 'test message',
            items: [0xfffffff1, 0xfffffff2, 0xfffffff3, 0xfffffff4],
        };
        bp.writeHeader(header);

        bp.length.should.equal(BufferPlus.byteLengthHeader(header));

        bp.moveTo(0);

        bp.readHeader().should.deep.equal(header);
    });

    it('#compound array', () => {
        const items = [];
        for (let i = 0; i < 100; i++) {
            items.push({
                type: 0x8,
                message: 'test message ' + i,
                items: [0xffffff0 + i, 0xffffff1 + i],
            });
        }

        bp.writeArray(items, 'Header');
        bp.writeArray(items, 'Header');

        bp.moveTo(0);
        bp.readArray('Header').should.deep.equal(items);
        bp.readArray('Header').should.deep.equal(items);
    });
});
