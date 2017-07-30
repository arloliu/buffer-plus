'use strict';
const Buffer = require('buffer').Buffer;
const BufferPlus = require('./BufferPlus.js');
const BufferSchema = require('./BufferSchema.js');
const VarInt = require('./VarInt.js');

exports.Buffer = BufferPlus;
exports.Schema = BufferSchema;

// Buffer.isBuffer(obj)
exports.isBuffer = Buffer.isBuffer;
exports.isBufferPlus = function(obj)
{
    return obj instanceof BufferPlus;
};

exports.byteLengthVarInt = VarInt.byteLengthInt;
exports.byteLengthVarUInt = VarInt.byteLengthUInt;

// Buffer.isEncoding(encoding)
exports.isEncoding = Buffer.isEncoding;

// Buffer.poolSize
exports.poolSize = Buffer.poolSize;


// Buffer.alloc(size[, fill[, encoding]])
exports.alloc = function()
{
    const buf = Buffer.alloc.apply(null, arguments);
    const bp = new BufferPlus(buf);
    bp.reset();
    return bp;
};

// Buffer.allocUnsafe(size)
exports.allocUnsafe = function(size)
{
    const buf = Buffer.allocUnsafe(size);
    const bp = new BufferPlus(buf);
    bp.reset();
    return bp;
};

// Buffer.allocUnsafeSlow(size)
exports.allocUnsafeSlow = function(size)
{
    const buf = Buffer.allocUnsafeSlow(size);
    const bp = new BufferPlus(buf);
    bp.reset();
    return bp;
};

// Buffer.byteLength(string[, encoding])
exports.byteLength = Buffer.byteLength;

// Buffer.compare(buf1, buf2)
exports.compare = function(buf1, buf2)
{
    if (buf1 instanceof Buffer)
    {
        if (buf2 instanceof Buffer)
            return Buffer.compare(buf1, buf2);
        else if (buf2 instanceof BufferPlus)
            return Buffer.compare(buf1, buf2.toBuffer());
        else
            throw new TypeError('Arguments must be Buffer or BufferPlus');
    }
    else if (buf1 instanceof BufferPlus)
    {
        if (buf2 instanceof Buffer)
            return Buffer.compare(buf1.toBuffer(), buf2);
        else if (buf2 instanceof BufferPlus)
            return Buffer.compare(buf1.toBuffer(), buf2.toBuffer());
        else
            throw new TypeError('Arguments must be Buffer or BufferPlus');
    }
    else
    {
        throw new TypeError('Arguments must be Buffer or BufferPlus');
    }
};

// Buffer.concat(list[, totalLength])
exports.concat = function(list, length)
{
    if (!Array.isArray(list))
        throw new TypeError('"list" argument must be an Array of Buffers');

    if (list.length === 0)
        return BufferPlus();

    var buf = null;
    if (list[0] instanceof Buffer)
    {
        buf = Buffer.concat(list, length);
    }
    else if (list[0] instanceof BufferPlus)
    {
        let bufs = [];
        for (let i = 0; i < list.length; i++)
            bufs.push(list[i].toBuffer());
        buf = Buffer.concat(bufs, length);
    }
    else
        throw new TypeError('"list" argument must be an Array of Buffers or BufferPlus');

    return new BufferPlus(buf);
};


// Buffer.from(...)
exports.from = function()
{
    let buf;
    if (arguments.length === 1 && arguments[0] instanceof BufferPlus)
        buf = arguments[0];
    else
        buf = Buffer.from.apply(null, arguments);
    return new BufferPlus(buf);
};


// addCustomType(name, readFunction, writeFunction, sizeFunction)
exports.addCustomType = function(name, readFunction, writeFunction, sizeFunction)
{
    const validNameRegexp = /^[a-z0-9]+$/i;
    if (typeof name !== 'string' || !validNameRegexp.test(name))
        throw new TypeError('name must be a valid string which contains only alphanumeric characters');

    if (typeof readFunction !== 'function'
        || typeof writeFunction !== 'function'
        || typeof sizeFunction !== 'function'
    )
    {
        throw new TypeError('Invalid read/write/size function');
    }

    BufferPlus.prototype['read' + name] = function() {
        return readFunction.call(null, this);
    };

    BufferPlus.prototype['write' + name] = function(value, insertOffset) {
        if (typeof insertOffset === 'number')
        {
            const tempBuf = new BufferPlus();
            writeFunction.call(null, tempBuf, value);
            this.writeBuffer(tempBuf.toBuffer(), insertOffset);
        }
        else
        {
            writeFunction.call(null, this, value);
        }
        return this;
    };

    BufferPlus.prototype['byteLength' + name] = function (value) {
        return sizeFunction.call(null, this, value);
    };

    BufferPlus._registerCustomType(
        name,
        BufferPlus.prototype['read' + name],
        BufferPlus.prototype['write' + name],
        BufferPlus.prototype['byteLength' + name]
    );

};


exports.createSchema = function(name)
{
    const schema = new BufferSchema(name);
    BufferPlus._registerSchema(name, schema);
    return schema;
};

exports.getSchema = BufferPlus.getSchema;
