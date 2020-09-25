'use strict';

var Buffer = require('buffer').Buffer;

var BufferPlus = require('./BufferPlus.js');

var BufferSchema = require('./BufferSchema.js');

var VarInt = require('./VarInt.js');

exports.Buffer = BufferPlus;
exports.Schema = BufferSchema;
exports.isBuffer = Buffer.isBuffer;

exports.isBufferPlus = function (obj) {
  return obj instanceof BufferPlus;
};

exports.isEncoding = Buffer.isEncoding;
exports.poolSize = Buffer.poolSize;

exports.alloc = function () {
  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  var buf = Buffer.alloc.apply(null, args);
  var bp = new BufferPlus(buf);
  bp.reset();
  return bp;
};

exports.allocUnsafe = function (size) {
  return new BufferPlus(size);
};

exports.allocUnsafeSlow = function (size) {
  var buf = Buffer.allocUnsafeSlow(size);
  var bp = new BufferPlus(buf);
  bp.reset();
  return bp;
};

exports.compare = function (buf1, buf2) {
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

exports.concat = function (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers');
  }

  if (list.length === 0) {
    return BufferPlus();
  }

  var buf = null;

  if (list[0] instanceof Buffer) {
    buf = Buffer.concat(list, length);
  } else if (list[0] instanceof BufferPlus) {
    var bufs = [];

    for (var i = 0; i < list.length; i++) {
      bufs.push(list[i].toBuffer());
    }

    buf = Buffer.concat(bufs, length);
  } else {
    throw new TypeError('"list" argument must be an Array of Buffers or BufferPlus');
  }

  return new BufferPlus(buf);
};

exports.create = function (arg) {
  if (typeof arg === 'number' || arg instanceof Buffer || arg instanceof BufferPlus) {
    return new BufferPlus(arg);
  } else if (arg === undefined) {
    return new BufferPlus(64);
  } else {
    throw TypeError('argument should be Buffer, BufferPlus or number of size');
  }
};

exports.from = function (value, encodingOrOffset, length) {
  var buf;

  if (value instanceof BufferPlus || value instanceof Buffer) {
    buf = value;
  } else {
    buf = Buffer.from.apply(null, arguments);
  }

  return new BufferPlus(buf);
};

exports.clone = function (value, encodingOrOffset, length) {
  var buf;

  if (value instanceof BufferPlus) {
    buf = Buffer.allocUnsafe(value.length);
    value.toBuffer().copy(buf, 0, 0, value.length);
  } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    var tempBuf = Buffer.from(value, encodingOrOffset, length);
    buf = Buffer.allocUnsafe(tempBuf.length);
    tempBuf.copy(buf, 0, 0, tempBuf.length);
  } else {
    buf = Buffer.from.apply(null, arguments);
  }

  return new BufferPlus(buf);
};

exports.hasCustomType = BufferPlus.hasCustomType;

exports.addCustomType = function (name, readFunction, writeFunction, sizeFunction) {
  var validNameRegexp = /^[$a-z_][0-9a-z_$]*$/i;

  if (typeof name !== 'string' || !validNameRegexp.test(name)) {
    throw new TypeError('name must be a valid function name');
  }

  if (typeof readFunction !== 'function' || typeof writeFunction !== 'function' || typeof sizeFunction !== 'function') {
    throw new TypeError('Invalid read/write/size function');
  }

  BufferPlus.prototype['read' + name] = function () {
    return readFunction.call(null, this);
  };

  BufferPlus.prototype['write' + name] = function (value, insertOffset) {
    if (typeof insertOffset === 'number') {
      var tempBuf = new BufferPlus();
      writeFunction.call(null, tempBuf, value);
      this.writeBuffer(tempBuf.toBuffer(), insertOffset);
    } else {
      writeFunction.call(null, this, value);
    }

    return this;
  };

  BufferPlus._registerCustomType(name, BufferPlus.prototype['read' + name], BufferPlus.prototype['write' + name], sizeFunction);

  exports['byteLength' + name] = sizeFunction;
};

exports.createSchema = function (name, schema) {
  var schemaInstance = new BufferSchema(name, schema);

  BufferPlus._registerSchema(name, schemaInstance);

  if (schema instanceof Object) {
    schemaInstance.buildOnce();
  }

  return schemaInstance;
};

exports.hasSchema = BufferPlus.hasSchema;
exports.getSchema = BufferPlus.getSchema;
exports.byteLength = Buffer.byteLength;
exports.byteLengthVarInt = VarInt.byteLengthInt;
exports.byteLengthVarUInt = VarInt.byteLengthUInt;
exports.byteLengthArray = BufferPlus.byteLengthArray;
exports.byteLengthPackedString = BufferPlus.byteLengthPackedString;
exports.byteLengthPackedBuffer = BufferPlus.byteLengthPackedBuffer;

exports.byteLengthVarInt = function (value) {
  return VarInt.byteLengthInt(value);
};

exports.byteLengthVarUInt = function (value) {
  return VarInt.byteLengthUInt(value);
};

exports.byteLengthSchema = function (name, obj) {
  var schema = BufferPlus.getSchema(name);

  if (!schema) {
    throw new Error('Schema "' + name + '" does not exist');
  }

  schema.buildOnce();
  return schema.byteLength(obj);
};