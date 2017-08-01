require('chai').should();
const BufferPlus = require('../lib/index.js');

describe('Custom. Type', function() {
    var bp = BufferPlus.allocUnsafe(1);

    beforeEach(function() {
        bp.reset();
    });

    before(function() {
        BufferPlus.addCustomType('HeaderString',
            (buffer) => {
                const len = buffer.readVarUInt();
                return buffer.readString(len);
            },
            (buffer, value) => {
                buffer.writeVarUInt(value.length);
                buffer.writeString(value);
            },
            (buffer, value) => {
                return BufferPlus.byteLengthVarUInt(value.length)
                    + BufferPlus.byteLength(value);
            }
        );

        BufferPlus.addCustomType('Header',
            (buffer) => {
                let obj = {};
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
            (buffer, value) => {
                return 1
                    + buffer.byteLengthHeaderString(value.message)
                    + buffer.byteLengthArray(value.items, 'uint32le');
            }
        );
    });


    it('#byteLength', function() {
        const testStr = 'header string';
        const testStrSize = bp.byteLengthHeaderString(testStr);
        bp.writeHeaderString(testStr);
        bp.position.should.equal(testStrSize);
    });

    it('#basic', function() {

        const testStr = 'header string';
        const testStr2 = 'header string2';
        const testStrSize = bp.byteLengthHeaderString(testStr);
        bp.writeUInt32LE(testStrSize);
        bp.writeHeaderString(testStr);
        bp.writeHeaderString(testStr2);

        bp.moveTo(0);
        bp.readUInt32LE().should.equal(testStrSize);
        bp.readHeaderString().should.equal(testStr);
        bp.readHeaderString().should.equal(testStr2);
    });

    it('#compound', function() {
        let header = {
            type: 0x8,
            message: 'test message',
            items: [0xfffffff1, 0xfffffff2, 0xfffffff3, 0xfffffff4]
        };
        bp.writeHeader(header);

        bp.length.should.equal(bp.byteLengthHeader(header));

        bp.moveTo(0);

        bp.readHeader().should.deep.equal(header);
    });

    it('#compound array', function () {
        const items = [];
        for (let i = 0; i < 100; i++)
        {
            items.push({
                type: 0x8,
                message: 'test message ' + i,
                items: [0xffffff0 + i, 0xffffff1 + i]
            });
        }

        bp.writeArray(items, 'Header');
        bp.writeArray(items, 'Header');

        bp.moveTo(0);
        bp.readArray('Header').should.deep.equal(items);
        bp.readArray('Header').should.deep.equal(items);

    });

});
