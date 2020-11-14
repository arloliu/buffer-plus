'use strict';
const nodeBuffer = require('buffer');
const Buffer = nodeBuffer.Buffer;
const Int64BE = require('int64-buffer').Int64BE;
const Int64LE = require('int64-buffer').Int64LE;
const UInt64BE = require('int64-buffer').Uint64BE;
const UInt64LE = require('int64-buffer').Uint64LE;
const VarInt = require('./VarInt.js');

const DEFAULT_BUFFER_SIZE = 4096;
const CUSTOM_TYPE_MAP = {};
const SCHEMA_OBJS = {};

// eslint-disable-next-line no-unused-vars
const nodeUtil = require('util');
// eslint-disable-next-line no-unused-vars
const debug = (nodeUtil && nodeUtil.debuglog) ? nodeUtil.debuglog('bp') : function() {};

// Declare built-in type map first
let BUILTIN_TYPE_MAP = {};

/* Internal helper functions */
function _getTypeFuncMap(type) {
    if (typeof type !== 'string') {
        return undefined;
    }

    const typeLowerCase = type.toLowerCase();

    if (BUILTIN_TYPE_MAP.hasOwnProperty(typeLowerCase)) {
        return BUILTIN_TYPE_MAP[typeLowerCase];
    } else if (CUSTOM_TYPE_MAP.hasOwnProperty(type)) {
        return CUSTOM_TYPE_MAP[type];
    }

    return undefined;
}

function _readArrayFromBuffer(buffer, funcMap) {
    const len = buffer.readVarUInt();
    const readFunc = funcMap.read.bind(buffer);
    const values = new Array(len);

    for (let i = 0; i < len; i++) {
        values[i] = readFunc();
    }
    return values;
}

function _writeArrayToBuffer(buffer, items, funcMap) {
    const len = items.length;
    const writeFunc = funcMap.write.bind(buffer);

    buffer.writeVarUInt(len);
    for (let i = 0; i < len; i++) {
        writeFunc(items[i]);
    }
}

class BufferPlus {
    // BufferPlus([encoding])
    // BufferPlus(size[, encoding])
    // BufferPlus(buffer[, encoding])
    constructor(a1, a2) {
        // default encoding
        this._defaultEncoding = 'utf8';
        // buffer length
        this._len = 0;
        // read & write position
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
            if (!Buffer.isEncoding(a1)) {
                throw new TypeError('encoding must be a valid string encoding');
            }
            this._buf = Buffer.allocUnsafe(DEFAULT_BUFFER_SIZE);
            this._defaultEncoding = a1;
        } else {
            this._buf = Buffer.allocUnsafe(DEFAULT_BUFFER_SIZE);
        }

        if (typeof a2 === 'string') {
            if (!Buffer.isEncoding(a2)) {
                throw new TypeError('encoding must be a valid string encoding');
            }
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

    get remaining() {
        return (this._len - this._pos);
    }

    get encoding() {
        return this._defaultEncoding;
    }

    setEncoding(encoding) {
        if (!Buffer.isEncoding(encoding)) {
            throw new TypeError('encoding must be a valid string encoding');
        }
        this._defaultEncoding = encoding;
        return this;
    }

    reset() {
        this._pos = 0;
        this._len = 0;
        return this;
    }

    seal(position) {
        const pos = (typeof position === 'number') ? position : this._pos;
        if (!Number.isSafeInteger(pos) || pos < 0 || pos > this._len) {
            throw new RangeError('Invalid position. position must be a valid integer between 0 to length - 1');
        }
        this._len = this._pos;
        return this;
    }

    toBuffer() {
        return this._buf.slice(0, this._len);
    }

    toArrayBuffer() {
        const b = this._buf.slice(0, this._len);
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    }

    toDataView(byteOffset, byteLength) {
        const b = this._buf.slice(0, this._len);
        const arrayBuffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
        return new DataView(arrayBuffer, byteOffset, byteLength);
    }

    toInt8Array() {
        const b = this._buf.slice(0, this._len);
        return new Int8Array(b.buffer, b.byteOffset, b.length);
    }

    toUint8Array() {
        const b = this._buf.slice(0, this._len);
        return new Uint8Array(b.buffer, b.byteOffset, b.length);
    }

    toInt16Array() {
        const b = this._buf.slice(0, this._len);
        return new Int16Array(b.buffer, b.byteOffset, b.length);
    }

    toUint16Array() {
        const b = this._buf.slice(0, this._len);
        return new Uint16Array(b.buffer, b.byteOffset, b.length);
    }

    toInt32Array() {
        const b = this._buf.slice(0, this._len);
        return new Int32Array(b.buffer, b.byteOffset, b.length);
    }

    toUint32Array() {
        const b = this._buf.slice(0, this._len);
        return new Uint32Array(b.buffer, b.byteOffset, b.length);
    }

    toString(encoding) {
        const val = (typeof encoding === 'string') ? encoding : this._defaultEncoding;
        if (!Buffer.isEncoding(val)) {
            throw new TypeError('encoding must be a valid string encoding');
        }
        return this._buf.toString(val, 0, this._len);
    }

    getRemainingBuffer() {
        return this._buf.slice(this._pos, this._len);
    }

    moveTo(position, force) {
        if (!Number.isSafeInteger(position)) {
            throw new TypeError('position must be a valid integer number');
        }

        if (force === true && position > 0) {
            this._ensureWriteSize(position);
        }

        if (position < 0 || (position > 0 && position > this._len)) {
            throw new RangeError(`position must be between 0 to length, position: ${position}, len: ${this._len}`);
        }
        this._pos = position;
        return this;
    }

    skip(offset, force) {
        if (!Number.isSafeInteger(offset)) {
            throw new TypeError('position must be a valid integer number');
        }

        if (force === true) {
            this._ensureWriteSize(offset);
        }

        const position = this._pos + offset;

        if (position < 0 || position > this._len) {
            throw new RangeError('skip position must be between 0 to length');
        }

        this._pos = position;
        return this;
    }

    rewind(offset) {
        if (!Number.isSafeInteger(offset)) {
            throw new TypeError('position must be a valid integer number');
        }

        const position = this._pos - offset;
        if (position < 0 || position > this._len) {
            throw new RangeError('skip position must be between 0 to length');
        }

        this._pos = position;
        return this;
    }

    readBuffer(length) {
        const len = (typeof length === 'number') ? length : this._len - this._pos;
        const end = Math.min(this._len, this._pos + len);

        const value = this._buf.slice(this._pos, end);
        this._pos = end;
        return value;
    }

    // writeBuffer(buf[, insertOffset])
    writeBuffer(buf, insertOffset) {
        if (!(buf instanceof Buffer)) {
            throw new TypeError('buf must be a Buffer');
        }

        this._ensureWriteSize(buf.length, insertOffset);

        const offset = this._calculateOffset(insertOffset);

        buf.copy(this._buf, offset);

        // increase position when write offset is smaller or equals to current position
        if (offset <= this._pos) {
            this._pos += buf.length;
        }

        return this;
    }

    // readString([length][, encoding])
    readString(a1, a2) {
        let length = this._len - this._pos;
        let encoding = this._defaultEncoding;
        if (typeof a1 === 'number') {
            length = a1;
        } else if (typeof a1 === 'string') {
            encoding = a1;
        } else if (typeof a2 === 'string') {
            encoding = a2;
        }


        const end = Math.min(this._len, this._pos + length);

        const value = this._buf.toString(encoding, this._pos, end);
        this._pos = end;
        return value;
    }

    // writeString(value [, insertOffset][, encoding])
    writeString(a1, a2, a3) {
        // if (arguments.length < 1 ||  typeof a1 !== 'string')
        //     throw new Error('the value of writeString() must be a string');

        const value = a1;
        let insertOffset;
        let encoding = this._defaultEncoding;

        if (arguments.length > 1) {
            // writeString(value, insertOffset[, encoding])
            if (typeof a2 === 'number') {
                insertOffset = a2;
                // writeString(value, insertOffset, encoding)
                if (typeof a3 === 'string') {
                    if (Buffer.isEncoding(a3)) {
                        encoding = a3;
                    } else {
                        throw new TypeError('encoding must be a valid string encoding');
                    }
                }
            } else if (typeof a2 === 'string') {
                // writeString(value, encoding)
                if (Buffer.isEncoding(a2)) {
                    encoding = a2;
                } else {
                    throw new TypeError('encoding must be a valid string encoding');
                }
            }
        }
        const byteLength = Buffer.byteLength(value, encoding);

        this._ensureWriteSize(byteLength, insertOffset);

        const offset = this._calculateOffset(insertOffset);
        this._buf.write(value, offset, byteLength, encoding);

        // increase position when write offset is smaller or equals to current position
        if (offset <= this._pos) {
            this._pos += byteLength;
        }

        return this;
    }

    readArray(type) {
        const funcMap = _getTypeFuncMap(type);
        if (funcMap === undefined) {
            throw new TypeError('Unknown type of built-in or custom types');
        }

        return _readArrayFromBuffer(this, funcMap);
    }

    writeArray(items, type, insertOffset) {
        if (!Array.isArray(items)) {
            throw new TypeError('items must be a valid Array');
        }
        if (items.length < 0) {
            throw new RangeError('items length must be greater than or equal to zero');
        }

        const funcMap = _getTypeFuncMap(type);
        if (funcMap === undefined) {
            throw new TypeError('Unknown type of built-in or custom types, type=' + type);
        }

        if (typeof insertOffset === 'number') {
            const tempBuf = new BufferPlus();
            _writeArrayToBuffer(tempBuf, items, funcMap);
            this.writeBuffer(tempBuf.toBuffer(), insertOffset);
        } else {
            _writeArrayToBuffer(this, items, funcMap);
        }
        return this;
    }
    // Boolean
    readBoolean() {
        return this._readNumber(Buffer.prototype.readUInt8, 1) ? true : false;
    }

    writeBoolean(value, insertOffset) {
        return this._writeNumber(Buffer.prototype.writeUInt8, 1, value ? 1 : 0, insertOffset);
    }

    // Signed Integers
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

    // Unsigned Integers
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

    // Floating Points
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


    // Double Floating Points
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

    // Variable Integers
    readVarUInt() {
        const result = VarInt.decodeUInt(this._buf, this._pos, this._len);
        this._pos += result[1];
        return result[0];
    }

    readVarInt() {
        const result = VarInt.decodeInt(this._buf, this._pos, this._len);
        this._pos += result[1];
        return result[0];
    }

    writeVarUInt(value, insertOffset) {
        const output = new Array(10);
        const count = VarInt.encodeUInt(value, output);

        this._ensureWriteSize(count, insertOffset);
        const offset = this._calculateOffset(insertOffset);

        for (let i = 0; i < count; i++) {
            this._buf[offset + i] = output[i];
        }

        if (offset <= this._pos) {
            this._pos += count;
        }

        return this;
    }

    writeVarInt(value, insertOffset) {
        const output = new Array(10);
        const count = VarInt.encodeInt(value, output);

        this._ensureWriteSize(count, insertOffset);
        const offset = this._calculateOffset(insertOffset);

        for (let i = 0; i < count; i++) {
            this._buf[offset + i] = output[i];
        }

        if (offset <= this._pos) {
            this._pos += count;
        }

        return this;
    }

    // methods for schema string
    readPackedString(encoding) {
        const len = this.readVarUInt();
        return this.readString(len, encoding);
    }

    // writePackedString(value [, insertOffset][, encoding])
    writePackedString(a1, a2, a3) {
        if (arguments.length < 1 || typeof a1 !== 'string') {
            throw new Error('the value of writeString() must be a string');
        }

        const value = a1;
        let insertOffset;
        let encoding;

        // writePackedString(value, insertOffset[, encoding])
        if (typeof a2 === 'number') {
            insertOffset = a2;
        } else if (typeof a2 === 'string') { // writePackedString(value, encoding)
            if (Buffer.isEncoding(a2)) {
                encoding = a2;
            } else {
                throw new TypeError('encoding must be a valid string encoding');
            }
        }
        // writePackedString(value, insertOffset, encoding)
        encoding = (typeof a3 === 'string') ? a3 : this._defaultEncoding;

        if (typeof insertOffset === 'number') {
            const valueSize = Buffer.byteLength(value, encoding);
            const varIntSize = VarInt.byteLengthUInt(valueSize);

            const tempBuf = Buffer.allocUnsafe(varIntSize + valueSize);
            VarInt.encodeUInt(valueSize, tempBuf);
            tempBuf.write(value, varIntSize, valueSize, encoding);

            this.writeBuffer(tempBuf, insertOffset);
        } else {
            const valueLen = Buffer.byteLength(value, encoding);
            this.writeVarUInt(valueLen);

            this._ensureWriteSize(valueLen);
            this._buf.write(value, this._pos, valueLen, encoding);
            this._pos += valueLen;
        }
        return this;
    }

    readPackedBuffer() {
        const len = this.readVarUInt();
        return this.readBuffer(len);
    }

    // writePackedBuffer(value[, insertOffset])
    writePackedBuffer(value, insertOffset) {
        if (typeof insertOffset === 'number') {
            const valueSize = value.length;
            const varIntSize = VarInt.byteLengthUInt(valueSize);

            const tempBuf = Buffer.allocUnsafe(varIntSize + valueSize);
            VarInt.encodeUInt(valueSize, tempBuf);
            value.copy(tempBuf, varIntSize, 0, valueSize);

            this.writeBuffer(tempBuf, insertOffset);
        } else {
            this.writeVarUInt(value.length);
            this.writeBuffer(value);
        }
        return this;
    }

    readSchema(name) {
        const schema = SCHEMA_OBJS[name];
        if (!schema) {
            throw new Error('Schema "' + name + '" does not exist');
        }

        schema.buildOnce();

        return schema.decode(this);
    }

    writeSchema(name, value, insertOffset) {
        const schema = SCHEMA_OBJS[name];
        if (!schema) {
            throw new Error('Schema "' + name + '" does not exist');
        }

        schema.buildOnce();

        if (typeof insertOffset === 'number') {
            const tempBuf = new BufferPlus(schema.byteLength(value));
            schema.encode(tempBuf, value);
            this.writeBuffer(tempBuf.toBuffer(), insertOffset);
        } else {
            schema.encode(this, value);
        }

        return this;
    }


    /** * Private methods ***/
    _forceOffset(offset) {
        this._len = this._pos + offset;
        this._pos = this._pos + offset;
    }

    _forceSkipTo(offset) {
        this._pos += offset;
    }

    _calculateOffset(insertOffset) {
        if (typeof insertOffset === 'number') {
            if (insertOffset < 0 || !Number.isSafeInteger(insertOffset)) {
                throw new RangeError('insert offset must be a valid integer greater than zero');
            }
            return insertOffset;
        }
        return this._pos;
    }

    _ensureWriteSize(dataSize, insertOffset) {
        const requireSize = (typeof insertOffset === 'number') ?
            Math.max(this._len, insertOffset) + dataSize
            : this._pos + dataSize;

        const origSize = this._buf.length;
        if (requireSize > origSize) {
            const origBuf = this._buf;
            const newSize = Math.max(origSize * 2, requireSize);
            this._buf = Buffer.allocUnsafe(newSize);
            origBuf.copy(this._buf, 0, 0, origSize);
        }

        // copy data into appropriate location if insertOffset is provided.
        if (typeof insertOffset === 'number') {
            // copy buffer from (insertOffset, bufLength) -> (insertOffset + dataSize, bufLength + dataSize)
            this._buf.copy(this._buf, insertOffset + dataSize, insertOffset, this._buf.length);
        }

        // adjust buffer length.
        if (requireSize > this._len) {
            this._len = requireSize;
        }
    }

    _readNumber(func, size) {
        // check reminding size is large enough
        if ((this._len - this._pos) < size) {
            throw new RangeError(`Reading beyond the length of buffer, len: ${this._len}, pos: ${this._pos}, size: ${size}`);
        }

        const value = func.call(this._buf, this._pos);
        this._pos += size;
        return value;
    }

    _writeNumber(func, size, value, insertOffset) {
        this._ensureWriteSize(size, insertOffset);

        const offset = this._calculateOffset(insertOffset);
        func.call(this._buf, value, offset, true);

        // increase position when write offset is smaller or equals to current position
        if (offset <= this._pos) {
            this._pos += size;
        }

        return this;
    }

    _readNumber64(int64Class) {
        // check reminding size is large enough
        if ((this._len - this._pos) < 8) {
            throw new RangeError('Reading beyond the length of buffer');
        }

        const value = new int64Class(this._buf.slice(this._pos, this._pos + 8));
        this._pos += 8;
        return value.toNumber();
    }

    _writeNumber64(int64Class, value, insertOffset) {
        this._ensureWriteSize(8, insertOffset);

        const offset = this._calculateOffset(insertOffset);

        const int64 = new int64Class(value);

        int64.toBuffer().copy(this._buf, offset, 0, 8);

        if (offset <= this._pos) {
            this._pos += 8;
        }

        return this;
    }
}

BufferPlus.hasSchema = function(name) {
    return SCHEMA_OBJS.hasOwnProperty(name);
};

BufferPlus.getSchema = function(name) {
    const schema = SCHEMA_OBJS[name];
    return schema;
};

BufferPlus.getAllSchemas = function() {
    const cloned = {};
    for (const key of Object.keys(SCHEMA_OBJS)) {
        cloned[key] = SCHEMA_OBJS[key];
    }
    return cloned;
};

BufferPlus.hasCustomType = function(type) {
    return CUSTOM_TYPE_MAP.hasOwnProperty(type);
};

BufferPlus.byteLengthPackedString = function(value, encoding) {
    const valueSize = Buffer.byteLength(value, encoding);
    return VarInt.byteLengthUInt(valueSize) + valueSize;
};

BufferPlus.byteLengthPackedBuffer = function(value) {
    return VarInt.byteLengthUInt(value.length) + value.length;
};

BufferPlus.byteLengthArray = function(items, type) {
    if (!Array.isArray(items)) {
        throw new TypeError('items must be a valid Array');
    }

    if (items.length < 1) {
        return 0;
    }

    const funcMap = _getTypeFuncMap(type);
    if (funcMap === undefined) {
        throw new TypeError('Unknown type of built-in or custom types');
    }

    const sizeFunc = funcMap.size;
    let bytes = VarInt.byteLengthUInt(items.length);
    for (let i = 0; i < items.length; i++) {
        bytes += (typeof sizeFunc === 'number') ? sizeFunc : sizeFunc(items[i]);
    }

    return bytes;
};


/** * Private static methods for factory function and BufferSchema ***/
BufferPlus._getDataTypeByteLength = function(value, dataType, encoding) {
    const funcMap = _getTypeFuncMap(dataType);
    if (funcMap === undefined) {
        return 0;
    }

    if (dataType.toLowerCase() === 'string') {
        return funcMap.size(value, encoding);
    }

    return (typeof funcMap.size === 'function') ? funcMap.size(value) : funcMap.size;
};

BufferPlus._registerCustomType = function(name, readFunc, writeFunc, sizeFunc) {
    CUSTOM_TYPE_MAP[name] = {
        read: readFunc,
        write: writeFunc,
        size: sizeFunc,
    };
};

BufferPlus._registerSchema = function(name, schema) {
    SCHEMA_OBJS[name] = schema;
};

BufferPlus._getTypeFuncMap = _getTypeFuncMap;

const protos = BufferPlus.prototype;
// set built-in type map here
BUILTIN_TYPE_MAP = {
    // boolean
    'bool': {size: 1, read: protos.readBoolean, write: protos.writeBoolean},
    'boolean': {size: 1, read: protos.readBoolean, write: protos.writeBoolean},
    // signed integers
    'int8': {size: 1, read: protos.readInt8, write: protos.writeInt8},
    'int16be': {size: 2, read: protos.readInt16BE, write: protos.writeInt16BE},
    'int16le': {size: 2, read: protos.readInt16LE, write: protos.writeInt16LE},
    'int32be': {size: 4, read: protos.readInt32BE, write: protos.writeInt32BE},
    'int32le': {size: 4, read: protos.readInt32LE, write: protos.writeInt32LE},
    'int64be': {size: 8, read: protos.readInt64BE, write: protos.writeInt64BE},
    'int64le': {size: 8, read: protos.readInt64LE, write: protos.writeInt64LE},

    // unsigned integers
    'uint8': {size: 1, read: protos.readUInt8, write: protos.writeUInt8},
    'uint16be': {size: 2, read: protos.readUInt16BE, write: protos.writeUInt16BE},
    'uint16le': {size: 2, read: protos.readUInt16LE, write: protos.writeUInt16LE},
    'uint32be': {size: 4, read: protos.readUInt32BE, write: protos.writeUInt32BE},
    'uint32le': {size: 4, read: protos.readUInt32LE, write: protos.writeUInt32LE},
    'uint64be': {size: 8, read: protos.readUInt64BE, write: protos.writeUInt64BE},
    'uint64le': {size: 8, read: protos.readUInt64LE, write: protos.writeUInt64LE},

    // float & double
    'floatbe': {size: 4, read: protos.FloatBE, write: protos.writeFloatBE},
    'floatle': {size: 4, read: protos.FloatLE, write: protos.writeFloatLE},
    'float32be': {size: 4, read: protos.FloatBE, write: protos.writeFloatBE},
    'float32le': {size: 4, read: protos.FloatLE, write: protos.writeFloatLE},
    'doublebe': {size: 8, read: protos.DoubleBE, write: protos.writeDoubleBE},
    'doublele': {size: 8, read: protos.DoubleLE, write: protos.writeDoubleLE},
    'float64be': {size: 8, read: protos.DoubleBE, write: protos.writeDoubleBE},
    'float64le': {size: 8, read: protos.DoubleLE, write: protos.writeDoubleLE},

    // variable integers
    'varint': {
        size: VarInt.byteLengthInt,
        read: protos.readVarInt,
        write: protos.writeVarInt,
    },
    'varuint': {
        size: VarInt.byteLengthUInt,
        read: protos.readVarUInt,
        write: protos.writeVarUInt,
    },


    // string
    'string': {
        size: BufferPlus.byteLengthPackedString,
        read: protos.readPackedString,
        write: protos.writePackedString,
    },
    'buffer': {
        size: BufferPlus.byteLengthPackedBuffer,
        read: protos.readPackedBuffer,
        write: protos.writePackedBuffer,
    },
};

module.exports = BufferPlus;
