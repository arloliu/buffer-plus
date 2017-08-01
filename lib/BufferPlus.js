'use strict';

var nodeBuffer = require('buffer');
var Buffer = nodeBuffer.Buffer;
var Int64BE = require('int64-buffer').Int64BE;
var Int64LE = require('int64-buffer').Int64LE;
var UInt64BE = require('int64-buffer').Uint64BE;
var UInt64LE = require('int64-buffer').Uint64LE;
var VarInt = require('./VarInt.js');

var nodeUtil = require('util');
var debug = nodeUtil && nodeUtil.debuglog ? nodeUtil.debuglog('bp') : function () {};

class BufferPlus {
    constructor(a1, a2) {
        this._defaultEncoding = 'utf8';

        this._len = 0;

        this._pos = 0;

        if (typeof a1 === 'number') {
            if (Number.isSafeInteger(a1) && a1 > 0) {
                this._buf = Buffer.allocUnsafe(a1);
            } else {
                throw new RangeError('Invalid size. Size must be a valid integer greater than zero');
            }
        } else if (a1 instanceof BufferPlus) {
            this._buf = a1.toBuffer();
            this._len = a1.length;
        } else if (a1 instanceof Buffer) {
            this._buf = a1;
            this._len = a1.length;
        } else if (typeof a1 === 'string') {
            if (!Buffer.isEncoding(a1)) throw new TypeError('encoding must be a valid string encoding');
            this._buf = Buffer.allocUnsafe(DEFAULT_BUFFER_SIZE);
            this._defaultEncoding = a1;
        } else {
            this._buf = Buffer.allocUnsafe(DEFAULT_BUFFER_SIZE);
        }

        if (typeof a2 === 'string') {
            if (!Buffer.isEncoding(a2)) throw new TypeError('encoding must be a valid string encoding');
            this._defaultEncoding = a2;
        }
    }

    get length() {
        return this._len;
    }

    get size() {
        return this._buf.length;
    }

    get position() {
        return this._pos;
    }

    reset() {
        this._pos = 0;
        this._len = 0;
    }

    seal(position) {
        var pos = typeof position === 'number' ? position : this._pos;
        if (!Number.isSafeInteger(pos) || pos < 0 || pos > this._len) {
            throw new RangeError('Invalid position. position must be a valid integer between 0 to length - 1');
        }
        this._len = this._pos;
    }

    remaining() {
        return this._len - this._pos;
    }

    toBuffer() {
        return this._buf.slice(0, this._len);
    }

    toString(encoding) {
        var val = typeof encoding === 'string' ? encoding : this._defaultEncoding;
        if (!Buffer.isEncoding(val)) throw new TypeError('encoding must be a valid string encoding');
        return this._buf.toString(val, 0, this._len);
    }

    moveTo(position) {
        if (!Number.isSafeInteger(position)) throw new TypeError('position must be a valid integer number');
        if (position < 0 || position > 0 && position >= this._len) throw new RangeError('position must be between 0 to length - 1');
        this._pos = position;
    }

    skip(offset) {
        if (!Number.isSafeInteger(offset)) throw new TypeError('position must be a valid integer number');

        var position = this._pos + offset;
        if (position < 0 || position >= this._len) throw new RangeError('skip position must be between 0 to length - 1');

        this._pos = position;
    }

    rewind(offset) {
        if (!Number.isSafeInteger(offset)) throw new TypeError('position must be a valid integer number');

        var position = this._pos - offset;
        if (position < 0 || position >= this._len) throw new RangeError('skip position must be between 0 to length - 1');

        this._pos = position;
    }

    readBuffer(length) {
        var len = typeof length === 'number' ? length : this._len;
        var end = Math.min(this._len, this._pos + len);

        var value = this._buf.slice(this._pos, end);
        this._pos = end;
        return value;
    }

    writeBuffer(buf, insertOffset) {
        if (!(buf instanceof Buffer)) throw new TypeError('buf must be a Buffer');

        this._ensureWriteSize(buf.length, insertOffset);

        var offset = this._calculateOffset(insertOffset);

        buf.copy(this._buf, offset);

        if (offset <= this._pos) this._pos += buf.length;

        return this;
    }

    readString(length, encoding) {
        var len = typeof length === 'number' ? length : this._len;
        var end = Math.min(this._len, this._pos + len);
        var encodingVal = typeof encoding === 'string' ? encoding : this._defaultEncoding;

        var value = this._buf.toString(encodingVal, this._pos, end);
        this._pos = end;
        return value;
    }

    writeString(a1, a2, a3) {

        var value = a1;
        var insertOffset = void 0;
        var encoding = this._defaultEncoding;

        if (arguments.length > 1) {
            if (typeof a2 === 'number') {
                insertOffset = a2;

                if (typeof a3 === 'string') {
                    if (Buffer.isEncoding(a3)) encoding = a3;else throw new TypeError('encoding must be a valid string encoding');
                }
            } else if (typeof a2 === 'string') {
                    if (Buffer.isEncoding(a2)) encoding = a2;else throw new TypeError('encoding must be a valid string encoding');
                }
        }
        var byteLength = Buffer.byteLength(value, encoding);

        this._ensureWriteSize(byteLength, insertOffset);

        var offset = this._calculateOffset(insertOffset);
        this._buf.write(value, offset, byteLength, encoding);

        if (offset <= this._pos) this._pos += byteLength;

        return this;
    }

    readArray(type) {

        var funcMap = BufferPlus._getTypeFuncMap(type);
        if (funcMap === undefined) throw new TypeError('Unknown type of built-in or custom types');

        return _readArrayFromBuffer(this, funcMap);
    }

    writeArray(items, type, insertOffset) {
        if (!Array.isArray(items)) throw new TypeError('items must be a valid Array');

        if (items.length < 1) throw new RangeError('items length must be greater than zero');

        var funcMap = BufferPlus._getTypeFuncMap(type);
        if (funcMap === undefined) throw new TypeError('Unknown type of built-in or custom types, type=' + type);

        if (typeof insertOffset === 'number') {
            var tempBuf = new BufferPlus();
            _writeArrayToBuffer(tempBuf, items, funcMap);
            this.writeBuffer(tempBuf.toBuffer(), insertOffset);
        } else {
            _writeArrayToBuffer(this, items, funcMap);
        }
        return this;
    }

    byteLengthArray(items, type) {
        if (!Array.isArray(items)) throw new TypeError('items must be a valid Array');

        if (items.length < 1) return 0;

        var funcMap = BufferPlus._getTypeFuncMap(type);
        if (funcMap === undefined) throw new TypeError('Unknown type of built-in or custom types');

        var sizeFunc = funcMap.size;
        var bytes = VarInt.byteLengthUInt(items.length);
        for (var i = 0; i < items.length; i++) {
            if (typeof sizeFunc === 'number') bytes += sizeFunc;else bytes += sizeFunc(items[i]);
        }

        return bytes;
    }

    readInt8() {
        return this._readNumber(Buffer.prototype.readInt8, 1);
    }
    readInt16BE() {
        return this._readNumber(Buffer.prototype.readInt16BE, 2);
    }
    readInt16LE() {
        return this._readNumber(Buffer.prototype.readInt16LE, 2);
    }
    readInt32BE() {
        return this._readNumber(Buffer.prototype.readInt32BE, 4);
    }
    readInt32LE() {
        return this._readNumber(Buffer.prototype.readInt32LE, 4);
    }
    readInt64BE() {
        return this._readNumber64(Int64BE);
    }
    readInt64LE() {
        return this._readNumber64(Int64LE);
    }

    writeInt8(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeInt8, 1, value, insertOffset);
    }
    writeInt16BE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeInt16BE, 2, value, insertOffset);
    }
    writeInt16LE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeInt16LE, 2, value, insertOffset);
    }
    writeInt32BE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeInt32BE, 4, value, insertOffset);
    }
    writeInt32LE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeInt32LE, 4, value, insertOffset);
    }
    writeInt64BE(value, insertOffset) {
        return this._writeNumber64(Int64BE, value, insertOffset);
    }
    writeInt64LE(value, insertOffset) {
        return this._writeNumber64(Int64LE, value, insertOffset);
    }

    readUInt8() {
        return this._readNumber(Buffer.prototype.readUInt8, 1);
    }
    readUInt16BE() {
        return this._readNumber(Buffer.prototype.readUInt16BE, 2);
    }
    readUInt16LE() {
        return this._readNumber(Buffer.prototype.readUInt16LE, 2);
    }
    readUInt32BE() {
        return this._readNumber(Buffer.prototype.readUInt32BE, 4);
    }
    readUInt32LE() {
        return this._readNumber(Buffer.prototype.readUInt32LE, 4);
    }
    readUInt64BE() {
        return this._readNumber64(UInt64BE);
    }
    readUInt64LE() {
        return this._readNumber64(UInt64LE);
    }

    writeUInt8(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeUInt8, 1, value, insertOffset);
    }
    writeUInt16BE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeUInt16BE, 2, value, insertOffset);
    }
    writeUInt16LE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeUInt16LE, 2, value, insertOffset);
    }
    writeUInt32BE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeUInt32BE, 4, value, insertOffset);
    }
    writeUInt32LE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeUInt32LE, 4, value, insertOffset);
    }
    writeUInt64BE(value, insertOffset) {
        return this._writeNumber64(UInt64BE, value, insertOffset);
    }
    writeUInt64LE(value, insertOffset) {
        return this._writeNumber64(UInt64LE, value, insertOffset);
    }

    readFloatBE() {
        return this._readNumber(Buffer.prototype.readFloatBE, 4);
    }
    readFloatLE() {
        return this._readNumber(Buffer.prototype.readFloatLE, 4);
    }

    writeFloatBE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeFloatBE, 4, value, insertOffset);
    }
    writeFloatLE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeFloatLE, 4, value, insertOffset);
    }

    readDoubleBE() {
        return this._readNumber(Buffer.prototype.readDoubleBE, 8);
    }
    readDoubleLE() {
        return this._readNumber(Buffer.prototype.readDoubleLE, 8);
    }

    writeDoubleBE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeDoubleBE, 8, value, insertOffset);
    }
    writeDoubleLE(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeDoubleLE, 8, value, insertOffset);
    }

    readVarUInt() {
        var result = VarInt.decodeUInt(this._buf, this._pos, this._len);
        this._pos += result[1];
        return result[0];
    }

    readVarInt() {
        var result = VarInt.decodeInt(this._buf, this._pos, this._len);
        this._pos += result[1];
        return result[0];
    }

    writeVarUInt(value, insertOffset) {
        var output = new Array(10);
        var count = VarInt.encodeUInt(value, output);

        this._ensureWriteSize(count, insertOffset);
        var offset = this._calculateOffset(insertOffset);

        for (var i = 0; i < count; i++) {
            this._buf[offset + i] = output[i];
        }if (offset <= this._pos) this._pos += count;

        return this;
    }

    writeVarInt(value, insertOffset) {
        var output = new Array(10);
        var count = VarInt.encodeInt(value, output);

        this._ensureWriteSize(count, insertOffset);
        var offset = this._calculateOffset(insertOffset);

        for (var i = 0; i < count; i++) {
            this._buf[offset + i] = output[i];
        }if (offset <= this._pos) this._pos += count;

        return this;
    }

    readPackedString(encoding) {
        var len = this.readVarUInt();
        return this.readString(len, undefined, encoding);
    }

    writePackedString(a1, a2, a3) {
        if (arguments.length < 1 || typeof a1 !== 'string') throw new Error('the value of writeString() must be a string');

        var value = a1;
        var insertOffset = void 0;
        var encoding = void 0;

        if (typeof a2 === 'number') {
            insertOffset = a2;
        } else if (typeof a2 === 'string') {
                if (Buffer.isEncoding(a2)) encoding = a2;else throw new TypeError('encoding must be a valid string encoding');
            }

        if (typeof a3 === 'string') {
            encoding = a3;
        } else {
            encoding = this._defaultEncoding;
        }

        if (typeof insertOffset === 'number') {
            var valueSize = Buffer.byteLength(value, encoding);
            var varIntSize = VarInt.byteLengthUInt(valueSize);

            var tempBuf = Buffer.allocUnsafe(varIntSize + valueSize);
            VarInt.encodeUInt(valueSize, tempBuf);
            tempBuf.write(value, varIntSize, valueSize, encoding);

            this.writeBuffer(tempBuf, insertOffset);
        } else {
            var valueLen = Buffer.byteLength(value, encoding);
            this.writeVarUInt(valueLen);

            this._ensureWriteSize(valueLen);
            this._buf.write(value, this._pos, valueLen, encoding);
            this._pos += valueLen;
        }
        return this;
    }

    byteLengthPackedString(value, encoding) {
        var valueSize = Buffer.byteLength(value, encoding);
        return VarInt.byteLengthUInt(valueSize) + valueSize;
    }

    readPackedBuffer(encoding) {
        var len = this.readVarUInt();
        return this.readBuffer(len);
    }

    writePackedBuffer(value, insertOffset) {
        if (typeof insertOffset === 'number') {
            var valueSize = value.length;
            var varIntSize = VarInt.byteLengthUInt(valueSize);

            var tempBuf = Buffer.allocUnsafe(varIntSize + valueSize);
            VarInt.encodeUInt(valueSize, tempBuf);
            value.copy(tempBuf, varIntSize, 0, valueSize);

            this.writeBuffer(tempBuf, insertOffset);
        } else {
            this.writeVarUInt(value.length);
            this.writeBuffer(value);
        }
        return this;
    }

    byteLengthPackedBuffer(value) {
        return VarInt.byteLengthUInt(value.length) + value.length;
    }

    byteLengthVarInt(value) {
        return VarInt.byteLengthInt(value);
    }

    byteLengthVarUInt(value) {
        return VarInt.byteLengthUInt(value);
    }

    readSchema(name) {
        var schema = BufferPlus.getSchema(name);
        if (!schema) throw new Error('Schema "' + name + '" does not exist');

        schema.buildOnce();

        return schema.decode(this);
    }

    writeSchema(name, value, insertOffset) {
        var schema = BufferPlus.getSchema(name);
        if (!schema) throw new Error('Schema "' + name + '" does not exist');

        schema.buildOnce();

        if (typeof insertOffset === 'number') {
            var tempBuf = new BufferPlus(schema.byteLength(value));
            schema.encode(tempBuf, value);
            this.writeBuffer(tempBuf.toBuffer(), insertOffset);
        } else {
            schema.encode(this, value);
        }

        return this;
    }

    _forceOffset(offset) {
        this._len = this._pos + offset;
        this._pos = this._pos + offset;
    }

    _forceMoveTo(position) {
        this._pos = position;
    }

    _calculateOffset(insertOffset) {
        if (typeof insertOffset === 'number') {
            if (insertOffset < 0 || !Number.isSafeInteger(insertOffset)) throw new RangeError('insert offset must be a valid integer greater than zero');
            return insertOffset;
        }
        return this._pos;
    }

    _ensureWriteSize(dataSize, insertOffset) {
        var requireSize = void 0;
        if (typeof insertOffset === 'number') requireSize = Math.max(this._len, insertOffset) + dataSize;else requireSize = this._pos + dataSize;

        var origSize = this._buf.length;
        if (requireSize > origSize) {
            var origBuf = this._buf;
            var newSize = Math.max(origSize * 2, requireSize);
            this._buf = Buffer.allocUnsafe(newSize);
            origBuf.copy(this._buf, 0, 0, origSize);
        }

        if (typeof insertOffset === 'number') {
            this._buf.copy(this._buf, insertOffset + dataSize, insertOffset, this._buf.length);
        }

        if (requireSize > this._len) this._len = requireSize;
    }

    _readNumber(func, size) {
        if (this._len - this._pos < size) throw new RangeError('Reading beyond the length of buffer');

        var value = func.call(this._buf, this._pos);
        this._pos += size;
        return value;
    }

    _writeNumber(func, size, value, insertOffset) {
        this._ensureWriteSize(size, insertOffset);

        var offset = this._calculateOffset(insertOffset);
        func.call(this._buf, value, offset, true);

        if (offset <= this._pos) this._pos += size;

        return this;
    }

    _readNumber64(int64Class) {
        if (this._len - this._pos < 8) throw new RangeError('Reading beyond the length of buffer');

        var value = new int64Class(this._buf.slice(this._pos, this._pos + 8));
        this._pos += 8;
        return value.toNumber();
    }

    _writeNumber64(int64Class, value, insertOffset) {
        this._ensureWriteSize(8, insertOffset);

        var offset = this._calculateOffset(insertOffset);

        var int64 = new int64Class(value);

        int64.toBuffer().copy(this._buf, offset, 0, 8);

        if (offset <= this._pos) this._pos += 8;
    }
}

BufferPlus.hasSchema = function (name) {
    return SCHEMA_OBJS.hasOwnProperty(name);
};

BufferPlus.getSchema = function (name) {
    return SCHEMA_OBJS[name];
};

BufferPlus.hasCustomType = function (type) {
    return CUSTOM_TYPE_MAP.hasOwnProperty(type);
};

BufferPlus._getDataTypeByteLength = function (value, dataType, encoding) {
    var funcMap = BufferPlus._getTypeFuncMap(dataType);
    if (funcMap === undefined) return 0;

    if (dataType.toLowerCase() === 'string') return funcMap.size(value, encoding);

    return typeof funcMap.size === 'function' ? funcMap.size(value) : funcMap.size;
};

BufferPlus._registerCustomType = function (name, readFunc, writeFunc, sizeFunc) {
    CUSTOM_TYPE_MAP[name] = {
        read: readFunc,
        write: writeFunc,
        size: sizeFunc
    };
};

BufferPlus._registerSchema = function (name, schema) {
    SCHEMA_OBJS[name] = schema;
};

BufferPlus._getTypeFuncMap = function (type) {
    if (typeof type !== 'string') return undefined;

    var typeLowerCase = type.toLowerCase();

    if (BUILTIN_TYPE_MAP.hasOwnProperty(typeLowerCase)) {
        return BUILTIN_TYPE_MAP[typeLowerCase];
    } else if (CUSTOM_TYPE_MAP.hasOwnProperty(type)) {
        return CUSTOM_TYPE_MAP[type];
    }

    return undefined;
};

function _readArrayFromBuffer(buffer, funcMap) {
    var len = buffer.readVarUInt();
    var readFunc = funcMap.read.bind(buffer);
    var values = new Array(len);
    for (var i = 0; i < len; i++) {
        values[i] = readFunc();
    }
    return values;
}

function _writeArrayToBuffer(buffer, items, funcMap) {
    var len = items.length;
    var writeFunc = funcMap.write.bind(buffer);

    buffer.writeVarUInt(len);
    for (var i = 0; i < len; i++) {
        writeFunc(items[i]);
    }
}

var DEFAULT_BUFFER_SIZE = 4096;
var CUSTOM_TYPE_MAP = {};
var SCHEMA_OBJS = {};

var protos = BufferPlus.prototype;
var BUILTIN_TYPE_MAP = {
    'int8': { size: 1, read: protos.readInt8, write: protos.writeInt8 },
    'int16be': { size: 2, read: protos.readInt16BE, write: protos.writeInt16BE },
    'int16le': { size: 2, read: protos.readInt16LE, write: protos.writeInt16LE },
    'int32be': { size: 4, read: protos.readInt32BE, write: protos.writeInt32BE },
    'int32le': { size: 4, read: protos.readInt32LE, write: protos.writeInt32LE },
    'int64be': { size: 8, read: protos.readInt64BE, write: protos.writeInt64BE },
    'int64le': { size: 8, read: protos.readInt64LE, write: protos.writeInt64LE },

    'uint8': { size: 1, read: protos.readUInt8, write: protos.writeUInt8 },
    'uint16be': { size: 2, read: protos.readUInt16BE, write: protos.writeUInt16BE },
    'uint16le': { size: 2, read: protos.readUInt16LE, write: protos.writeUInt16LE },
    'uint32be': { size: 4, read: protos.readUInt32BE, write: protos.writeUInt32BE },
    'uint32le': { size: 4, read: protos.readUInt32LE, write: protos.writeUInt32LE },
    'uint64be': { size: 8, read: protos.readUInt64BE, write: protos.writeUInt64BE },
    'uint64le': { size: 8, read: protos.readUInt64LE, write: protos.writeUInt64LE },

    'floatbe': { size: 4, read: protos.FloatBE, write: protos.writeFloatBE },
    'floatle': { size: 4, read: protos.FloatLE, write: protos.writeFloatLE },
    'doublebe': { size: 8, read: protos.DoubleBE, write: protos.writeDoubleBE },
    'doublele': { size: 8, read: protos.DoubleLE, write: protos.writeDoubleLE },

    'varint': {
        size: VarInt.byteLengthInt,
        read: protos.readVarInt,
        write: protos.writeVarInt
    },
    'varuint': {
        size: VarInt.byteLengthUInt,
        read: protos.readVarUInt,
        write: protos.writeVarUInt
    },

    'string': {
        size: protos.byteLengthPackedString,
        read: protos.readPackedString,
        write: protos.writePackedString
    },
    'buffer': {
        size: protos.byteLengthPackedBuffer,
        read: protos.readPackedBuffer,
        write: protos.writePackedBuffer
    }
};

module.exports = BufferPlus;