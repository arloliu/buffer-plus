'use strict';
const Buffer = require('buffer').Buffer;
const BufferPlus = require('./BufferPlus.js');
const BufferSchema = require('./BufferSchema.js');
const VarInt = require('./VarInt.js');

exports.Buffer = BufferPlus;
exports.Schema = BufferSchema;

// Buffer.isBuffer(obj)
exports.isBuffer = Buffer.isBuffer;
exports.isBufferPlus = function(obj) {
    return obj instanceof BufferPlus;
};

// Buffer.isEncoding(encoding)
exports.isEncoding = Buffer.isEncoding;

// Buffer.poolSize
exports.poolSize = Buffer.poolSize;


// Buffer.alloc(size[, fill[, encoding]])
exports.alloc = function(...args) {
    const buf = Buffer.alloc.apply(null, args);
    const bp = new BufferPlus(buf);
    bp.reset();
    return bp;
};

// Buffer.allocUnsafe(size)
exports.allocUnsafe = function(size) {
    return new BufferPlus(size);
};

// Buffer.allocUnsafeSlow(size)
exports.allocUnsafeSlow = function(size) {
    const buf = Buffer.allocUnsafeSlow(size);
    const bp = new BufferPlus(buf);
    bp.reset();
    return bp;
};

// Buffer.compare(buf1, buf2)
exports.compare = function(buf1, buf2) {
    if (buf1 instanceof Buffer) {
        if (buf2 instanceof Buffer) {
            return Buffer.compare(buf1, buf2);
        } else if (buf2 instanceof BufferPlus) {
            return Buffer.compare(buf1, buf2.toBuffer());
        } else {
            throw new TypeError('Arguments must be Buffer or BufferPlus');
        }
    } else if (buf1 instanceof BufferPlus) {
        if (buf2 instanceof Buffer) {
            return Buffer.compare(buf1.toBuffer(), buf2);
        } else if (buf2 instanceof BufferPlus) {
            return Buffer.compare(buf1.toBuffer(), buf2.toBuffer());
        } else {
            throw new TypeError('Arguments must be Buffer or BufferPlus');
        }
    } else {
        throw new TypeError('Arguments must be Buffer or BufferPlus');
    }
};

// Buffer.concat(list[, totalLength])
exports.concat = function(list, length) {
    if (!Array.isArray(list)) {
        throw new TypeError('"list" argument must be an Array of Buffers');
    }

    if (list.length === 0) {
        return BufferPlus();
    }

    let buf = null;
    if (list[0] instanceof Buffer) {
        buf = Buffer.concat(list, length);
    } else if (list[0] instanceof BufferPlus) {
        const bufs = [];
        for (let i = 0; i < list.length; i++) {
            bufs.push(list[i].toBuffer());
        }
        buf = Buffer.concat(bufs, length);
    } else {
        throw new TypeError('"list" argument must be an Array of Buffers or BufferPlus');
    }

    return new BufferPlus(buf);
};

// create([size])
// create(buffer)
exports.create = function(arg) {
    if (typeof arg === 'number' || arg instanceof Buffer || arg instanceof BufferPlus) {
        return new BufferPlus(arg);
    } else if (arg === undefined) {
        return new BufferPlus(64);
    } else {
        throw TypeError('argument should be Buffer, BufferPlus or number of size');
    }
};

// Buffer.from(...)
exports.from = function(value, encodingOrOffset, length) {
    let buf;
    if (value instanceof BufferPlus || value instanceof Buffer) {
        buf = value;
    } else {
        /* eslint-disable-next-line prefer-rest-params */
        buf = Buffer.from.apply(null, arguments);
    }

    return new BufferPlus(buf);
};

exports.clone = function(value, encodingOrOffset, length) {
    let buf;
    if (value instanceof BufferPlus) {
        buf = Buffer.allocUnsafe(value.length);
        value.toBuffer().copy(buf, 0, 0, value.length);
    } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        const tempBuf = Buffer.from(value, encodingOrOffset, length);
        buf = Buffer.allocUnsafe(tempBuf.length);
        tempBuf.copy(buf, 0, 0, tempBuf.length);
    } else {
        /* eslint-disable-next-line prefer-rest-params */
        buf = Buffer.from.apply(null, arguments);
    }

    return new BufferPlus(buf);
};

/** * Custom type methods ***/
exports.hasCustomType = BufferPlus.hasCustomType;

// addCustomType(name, readFunction, writeFunction, sizeFunction)
exports.addCustomType = function(name, readFunction, writeFunction, sizeFunction) {
    const validNameRegexp = /^[$a-z_][0-9a-z_$]*$/i;
    if (typeof name !== 'string' || !validNameRegexp.test(name)) {
        throw new TypeError('name must be a valid function name');
    }

    if (typeof readFunction !== 'function'
        || typeof writeFunction !== 'function'
        || typeof sizeFunction !== 'function'
    ) {
        throw new TypeError('Invalid read/write/size function');
    }

    BufferPlus.prototype['read' + name] = function() {
        return readFunction.call(null, this);
    };

    BufferPlus.prototype['write' + name] = function(value, insertOffset) {
        if (typeof insertOffset === 'number') {
            const tempBuf = new BufferPlus();
            writeFunction.call(null, tempBuf, value);
            this.writeBuffer(tempBuf.toBuffer(), insertOffset);
        } else {
            writeFunction.call(null, this, value);
        }
        return this;
    };


    BufferPlus._registerCustomType(
            name,
        BufferPlus.prototype['read' + name],
        BufferPlus.prototype['write' + name],
        sizeFunction
    );

    // register byteLength<name> method as module scope
    exports['byteLength' + name] = sizeFunction;
};

/** * Schema methods ***/
exports.createSchema = function(name, schema) {
    const schemaInstance = new BufferSchema(name, schema);
    BufferPlus._registerSchema(name, schemaInstance);
    return schemaInstance;
};

exports.hasSchema = BufferPlus.hasSchema;

exports.getSchema = BufferPlus.getSchema;


/** * byteLength methods ***/
// Buffer.byteLength(string[, encoding])
exports.byteLength = Buffer.byteLength;

exports.byteLengthVarInt = VarInt.byteLengthInt;

exports.byteLengthVarUInt = VarInt.byteLengthUInt;

exports.byteLengthArray = BufferPlus.byteLengthArray;

exports.byteLengthPackedString = BufferPlus.byteLengthPackedString;

exports.byteLengthPackedBuffer = BufferPlus.byteLengthPackedBuffer;

exports.byteLengthVarInt = function(value) {
    return VarInt.byteLengthInt(value);
};

exports.byteLengthVarUInt = function(value) {
    return VarInt.byteLengthUInt(value);
};

exports.byteLengthSchema = function(name, obj) {
    const schema = BufferPlus.getSchema(name);
    if (!schema) {
        throw new Error('Schema "' + name + '" does not exist');
    }

    schema.buildOnce();

    return schema.byteLength(obj);
};
