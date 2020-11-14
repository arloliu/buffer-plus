'use strict';

var BufferPlus = require('./BufferPlus.js');

var Int64BE = require('int64-buffer').Int64BE;

var Int64LE = require('int64-buffer').Int64LE;

var UInt64BE = require('int64-buffer').Uint64BE;

var UInt64LE = require('int64-buffer').Uint64LE;

var VarInt = require('./VarInt.js');

var nodeUtil = require('util');

var debug = nodeUtil && nodeUtil.debuglog ? nodeUtil.debuglog('bp') : function () {};
var helper = {};
var ObjectRequiredFields = ['type', 'properties'];
var ArrayRequiredFields = ['type', 'items'];
var READ_BUILTIN_TYPES = {
  'bool': 'helper.readBoolean(buffer);',
  'boolean': 'helper.readBoolean(buffer);',
  'int8': 'buffer.readInt8(helper.offset); helper.offset += 1;',
  'int16be': 'buffer.readInt16BE(helper.offset); helper.offset += 2;',
  'int16le': 'buffer.readInt16LE(helper.offset); helper.offset += 2;',
  'int32be': 'buffer.readInt32BE(helper.offset); helper.offset += 4;',
  'int32le': 'buffer.readInt32LE(helper.offset); helper.offset += 4;',
  'int64be': 'helper.readInt64BE(buffer);',
  'int64le': 'helper.readInt64LE(buffer);',
  'uint8': 'buffer.readUInt8(helper.offset); helper.offset += 1;',
  'uint16be': 'buffer.readUInt16BE(helper.offset); helper.offset += 2;',
  'uint16le': 'buffer.readUInt16LE(helper.offset); helper.offset += 2;',
  'uint32be': 'buffer.readUInt32BE(helper.offset); helper.offset += 4;',
  'uint32le': 'buffer.readUInt32LE(helper.offset); helper.offset += 4;',
  'uint64be': 'helper.readUInt64BE(buffer);',
  'uint64le': 'helper.readUInt64LE(buffer);',
  'floatbe': 'buffer.readFloatBE(helper.offset); helper.offset += 4;',
  'floatle': 'buffer.readFloatLE(helper.offset); helper.offset += 4;',
  'float32be': 'buffer.readFloatBE(helper.offset); helper.offset += 4;',
  'float32le': 'buffer.readFloatLE(helper.offset); helper.offset += 4;',
  'doublebe': 'buffer.readDoubleBE(helper.offset); helper.offset += 8;',
  'doublele': 'buffer.readDoubleLE(helper.offset); helper.offset += 8;',
  'float64be': 'buffer.readDoubleBE(helper.offset); helper.offset += 8;',
  'float64le': 'buffer.readDoubleLE(helper.offset); helper.offset += 8;',
  'varint': 'helper.readVarInt(buffer);',
  'varuint': 'helper.readVarUInt(buffer);',
  'string': 'helper.readString(buffer, strEnc);',
  'buffer': 'helper.readBuffer(buffer);'
};

function isReadBuiltinTypes(type) {
  return READ_BUILTIN_TYPES.hasOwnProperty(type.toLowerCase());
}

var _iterIndex = 1;
var _arrayValIndex = 1;

function getIterStr() {
  var iter = "j".concat(_iterIndex);
  _iterIndex++;
  return iter;
}

function getArrayValStr() {
  var val = "arrLen".concat(_arrayValIndex);
  _arrayValIndex++;
  return val;
}

function _genWriteStr(funcName, valueStr) {
  return "helper.offset = buffer.write".concat(funcName, "(").concat(valueStr, ", helper.offset);");
}

function isObject(obj) {
  var type = typeof obj;
  return type === 'function' || type === 'object' && !!obj;
}

;

function getBuiltinWriteString(dataType, valueStr) {
  switch (dataType) {
    case 'bool':
      return "helper.writeBoolean(buffer, ".concat(valueStr, " ? 1 : 0);");

    case 'boolean':
      return "helper.writeBoolean(buffer, ".concat(valueStr, " ? 1 : 0);");

    case 'int8':
      return _genWriteStr('Int8', valueStr);

    case 'int16be':
      return _genWriteStr('Int16BE', valueStr);

    case 'int16le':
      return _genWriteStr('Int16LE', valueStr);

    case 'int32be':
      return _genWriteStr('Int32BE', valueStr);

    case 'int32le':
      return _genWriteStr('Int32LE', valueStr);

    case 'int64be':
      return "helper.writeInt64BE(buffer, ".concat(valueStr, ");");

    case 'int64le':
      return "helper.writeInt64LE(buffer, ".concat(valueStr, ");");

    case 'uint8':
      return _genWriteStr('UInt8', valueStr);

    case 'uint16be':
      return _genWriteStr('UInt16BE', valueStr);

    case 'uint16le':
      return _genWriteStr('UInt16LE', valueStr);

    case 'uint32be':
      return _genWriteStr('UInt32BE', valueStr);

    case 'uint32le':
      return _genWriteStr('UInt32LE', valueStr);

    case 'uint64be':
      return "helper.writeUInt64BE(buffer, ".concat(valueStr, ");");

    case 'uint64le':
      return "helper.writeUInt64LE(buffer, ".concat(valueStr, ");");

    case 'floatbe':
      return _genWriteStr('FloatBE', valueStr);

    case 'floatle':
      return _genWriteStr('FloatLE', valueStr);

    case 'float32be':
      return _genWriteStr('FloatBE', valueStr);

    case 'float32le':
      return _genWriteStr('FloatLE', valueStr);

    case 'doublebe':
      return _genWriteStr('DoubleBE', valueStr);

    case 'doublele':
      return _genWriteStr('DoubleLE', valueStr);

    case 'float64be':
      return _genWriteStr('DoubleBE', valueStr);

    case 'float64le':
      return _genWriteStr('DoubleLE', valueStr);

    case 'varuint':
      return "helper.writeVarUInt(buffer, ".concat(valueStr, ");");

    case 'varint':
      return "helper.writeVarInt(buffer, ".concat(valueStr, ");");

    case 'string':
      return "helper.writeString(buffer, ".concat(valueStr, ", strEnc);");

    case 'buffer':
      return "helper.writeBuffer(buffer, ".concat(valueStr, ");");
  }

  return undefined;
}

function getBuiltinReadString(dataType, valueStr) {
  return valueStr + ' = ' + READ_BUILTIN_TYPES[dataType];
}

function getBuiltinSizeString(dataType, valueStr) {
  var funcMap = BufferPlus._getTypeFuncMap(dataType);

  if (!funcMap || !funcMap.size) {
    return '';
  }

  if (typeof funcMap.size === 'number') {
    return "byteCount += ".concat(funcMap.size, ";");
  }

  switch (dataType.toLowerCase()) {
    case 'string':
      return "byteCount += helper.byteLengthString(".concat(valueStr, ", strEnc);");

    case 'buffer':
      return "byteCount += helper.byteLengthBuffer(".concat(valueStr, ", strEnc);");

    case 'varint':
      return "byteCount += helper.byteLengthVarInt(".concat(valueStr, ");");

    case 'varuint':
      return "byteCount += helper.byteLengthVarUInt(".concat(valueStr, ");");
  }

  return "byteCount += helper.getDataTypeByteLength(".concat(valueStr, ", '").concat(dataType, "', strEnc);");
}

function getDataTypeFunctionString(type, readObjStrArg, writeObjStrArg) {
  var dataType = type.trim();
  var typeLowerCase = dataType.toLowerCase();
  var readObjStr = readObjStrArg.trim();
  var writeObjStr = writeObjStrArg.trim();

  if (isReadBuiltinTypes(dataType)) {
    return {
      read: getBuiltinReadString(typeLowerCase, readObjStr),
      write: getBuiltinWriteString(typeLowerCase, writeObjStr),
      size: getBuiltinSizeString(dataType, writeObjStr)
    };
  } else if (BufferPlus.hasCustomType(dataType)) {
    return {
      read: "".concat(readObjStr, " = helper.readCustomType(rBuffer, '").concat(dataType, "');"),
      write: "helper.writeCustomType(wBuffer, '".concat(dataType, "', ").concat(writeObjStr, ");"),
      size: "byteCount += helper.sizeCustomType('".concat(dataType, "', ").concat(writeObjStr, ");")
    };
  } else {
    throw new TypeError('Invalid data type:' + dataType);
  }
}

class BufferSchema {
  constructor(name, schemaDef) {
    this.name = name;
    this._encoding = 'utf8';
    this._decodeCtx = [];
    this._decodeInnerFuncs = {};
    this._encodeCtx = [];
    this._encodeInnerFuncs = {};
    this._byteLengthCtx = [];
    this._byteLengthInnerFuncs = {};
    this._refCtx = [];
    this._refIndex = 1;
    this._schemaDef = undefined;
    this._buildOnce = false;
    this._buildSchema = false;

    this._encodeFunc = function (a1, a2, a3) {
      throw new Error('Not implemented.');
    };

    this._decodeFunc = function (a1, a2) {
      throw new Error('Not implemented.');
    };

    this._byteLengthFunc = function (a1, a2) {
      throw new Error('Not implemented.');
    };

    if (isObject(schemaDef)) {
      this._schemaDef = schemaDef;
    }
  }

  getSchemaDef() {
    return this._schemaDef;
  }

  encode(buffer, data) {
    this._encodeFunc.call(null, buffer, data, helper);
  }

  decode(buffer) {
    return this._decodeFunc.call(null, buffer, helper);
  }

  byteLength(data) {
    return this._byteLengthFunc.call(null, data, helper);
  }

  setEncoding(encoding) {
    if (!BufferPlus.isEncoding(encoding)) {
      throw new TypeError('encoding must be a valid string encoding');
    }

    this._encoding = encoding;
  }

  addField(key, dataType) {
    var dataTypeStr = dataType instanceof BufferSchema ? "Schema.".concat(dataType.name) : dataType;
    debug("addField('".concat(key, "', '").concat(dataTypeStr, "') - Schema: ").concat(this.name));
    var funcStr;
    var readObjStr;
    var writeObjStr;

    if (typeof key !== 'string') {
      readObjStr = 'data';
      writeObjStr = 'json';
    } else {
      var dataKey = key.trim();
      readObjStr = "data['".concat(dataKey, "']");
      writeObjStr = "json['".concat(dataKey, "']");
    }

    if (dataType instanceof BufferSchema) {
      var _schema = dataType;
      var funcName = "Schema".concat(_schema.name);
      this._decodeInnerFuncs[_schema.name] = _schema.getDecodeNameFuncStr("_read".concat(funcName));
      this._encodeInnerFuncs[_schema.name] = _schema.getEncodeNameFuncStr("_write".concat(funcName));
      this._byteLengthInnerFuncs[_schema.name] = _schema.getByteLengthNameFuncStr("_byteLength".concat(funcName));
      funcStr = {
        read: "data.".concat(key, " = _read").concat(funcName, "(buffer, helper);"),
        write: "_write".concat(funcName, "(buffer, ").concat(writeObjStr, ", helper);"),
        size: "byteCount += _byteLength".concat(funcName, "(").concat(writeObjStr, ", helper);")
      };
    } else {
      funcStr = getDataTypeFunctionString(dataType, readObjStr, writeObjStr);
    }

    this._encodeCtx.push(funcStr.write);

    this._decodeCtx.push(funcStr.read);

    this._byteLengthCtx.push(funcStr.size);

    this._buildOnce = false;
    return this;
  }

  addArrayField(key, dataType) {
    var dataTypeStr = dataType instanceof BufferSchema ? "Schema.".concat(dataType.name) : dataType;
    debug("addArrayField('".concat(key, "', '").concat(dataTypeStr, "') - Schema: ").concat(this.name));
    var readItem;
    var writeItem;

    if (typeof key !== 'string') {
      readItem = "data";
      writeItem = this._addRefVal("json");
    } else {
      var refKey = key.trim();
      readItem = "data['".concat(refKey, "']");
      writeItem = this._addRefVal("json['".concat(refKey, "']"));
    }

    var arrayLenVal = getArrayValStr();
    var arrayIter = getIterStr();
    var readObjStr = "".concat(readItem, "[").concat(arrayIter, "]");
    var writeObjStr = "".concat(writeItem, "[").concat(arrayIter, "]");
    var arrayLenVal2 = getArrayValStr();
    var arrayIter2 = getIterStr();
    var writeObjStr2 = "".concat(writeItem, "[").concat(arrayIter2, "]");
    var funcStr;
    var sizeFuncStr;

    if (dataType instanceof BufferSchema) {
      var _schema2 = dataType;
      var schemaName = "Schema".concat(_schema2.name);
      this._decodeInnerFuncs[_schema2.name] = _schema2.getDecodeNameFuncStr("_read".concat(schemaName));
      this._encodeInnerFuncs[_schema2.name] = _schema2.getEncodeNameFuncStr("_write".concat(schemaName));
      this._byteLengthInnerFuncs[_schema2.name] = _schema2.getByteLengthNameFuncStr("_byteLength".concat(schemaName));
      funcStr = {
        read: "".concat(readObjStr, " = _read").concat(schemaName, "(buffer, helper);"),
        write: "_write".concat(schemaName, "(buffer, ").concat(writeObjStr, ", helper)")
      };
      sizeFuncStr = "byteCount += _byteLength".concat(schemaName, "(").concat(writeObjStr2, ", helper);");
    } else {
      funcStr = getDataTypeFunctionString(dataType, readObjStr, writeObjStr);
      sizeFuncStr = getBuiltinSizeString(dataType, writeObjStr2);
    }

    this._decodeCtx.push("\n            var ".concat(arrayLenVal, " = helper.readVarUInt(buffer);\n            ").concat(readItem, " = [];\n            for (var ").concat(arrayIter, " = 0; ").concat(arrayIter, " < ").concat(arrayLenVal, "; ").concat(arrayIter, "++) {\n                ").concat(funcStr.read, "\n            }\n        "));

    this._encodeCtx.push("\n            var ".concat(arrayLenVal, " = ").concat(writeItem, ".length;\n            helper.writeVarUInt(buffer, ").concat(arrayLenVal, ");\n            for (var ").concat(arrayIter, " = 0; ").concat(arrayIter, " < ").concat(arrayLenVal, "; ").concat(arrayIter, "++) {\n                ").concat(funcStr.write, "\n            }\n        "));

    this._byteLengthCtx.push("\n            var ".concat(arrayLenVal2, " = ").concat(writeItem, ".length;\n            byteCount += helper.byteLengthVarUInt(").concat(arrayLenVal2, ");\n            for (var ").concat(arrayIter2, " = 0; ").concat(arrayIter2, " < ").concat(arrayLenVal2, "; ").concat(arrayIter2, "++) {\n                ").concat(sizeFuncStr, "\n            }\n        "));

    this._buildOnce = false;
    return this;
  }

  _getSchemaInstance(name) {
    if (BufferPlus.hasSchema(name)) {
      return BufferPlus.getSchema(name);
    } else {
      var _schema3 = new BufferSchema(name);

      BufferPlus._registerSchema(name, _schema3);

      return _schema3;
    }
  }

  _compileSchemaArray(schemaName, name, schDef) {
    if (!isObject(schDef)) {
      throw new TypeError('Invalid schema definition');
    }

    if (typeof schDef.type !== 'string') {
      throw new SyntaxError("Schema definition requires valid 'type' field.");
    }

    var schemaInstance = this._getSchemaInstance(schemaName);

    var typeLowerCase = schDef.type.toLowerCase();
    debug("_compileSchemaArray schemaName: ".concat(schemaName, ", schDef.name: ").concat(schDef.name, ", name: ").concat(name, " type: ").concat(typeLowerCase));

    if (typeLowerCase === 'object') {
      this._compileSchemaObject(schemaName, schDef);
    } else if (typeLowerCase === 'schema') {
      var nestSchema = BufferPlus.getSchema(schDef.name);

      this._compileSchemaObject(schemaName, nestSchema._schemaDef);
    } else if (typeLowerCase === 'custom') {
      schemaInstance.addField(name, schDef.name);
    } else if (typeLowerCase === 'array') {
      ArrayRequiredFields.forEach(function (field) {
        if (!schDef.hasOwnProperty(field)) {
          throw new SyntaxError("Schema definition requires '".concat(field, "' field. definition: \n").concat(JSON.stringify(schema, null, 4)));
        }
      });
      var nestSchemaName = name ? "".concat(schemaName, "_").concat(name) : "".concat(schemaName, "_nested");

      if (isReadBuiltinTypes(schDef.items.type)) {
        schemaInstance.addArrayField(name, schDef.items.type);
      } else {
        this._compileSchemaArray(nestSchemaName, null, schDef.items);

        schemaInstance.addArrayField(name, BufferPlus.getSchema(nestSchemaName));
      }
    } else if (isReadBuiltinTypes(schDef.type)) {
      schemaInstance.addArrayField(name, schDef.type);
    }
  }

  _compileSchemaObject(schemaName, schDef) {
    var _this = this;

    debug("== _compileSchemaObject: schemaName: ".concat(schemaName));

    if (!isObject(schDef)) {
      throw new TypeError('Invalid schema definition' + JSON.stringify(schema));
    }

    if (schDef.type !== 'object') {
      throw new TypeError('Type of schema definition should be object');
    }

    ObjectRequiredFields.forEach(function (field) {
      if (!schDef.hasOwnProperty(field)) {
        throw new SyntaxError("Schema definition requires '".concat(field, "' field."));
      }
    });

    if (!isObject(schDef.properties)) {
      throw new TypeError('type of "properties" property within schema definition must be object.');
    }

    if (schDef.order === undefined) {
      schDef.order = [];
      var names = Object.getOwnPropertyNames(schDef.properties);
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = names[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var name = _step.value;

          if (schDef.properties.hasOwnProperty(name)) {
            schDef.order.push(name);
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }

    if (!Array.isArray(schDef.order)) {
      throw new TypeError('type of order property within schema definition must be array.');
    }

    var schemaInstance = this._getSchemaInstance(schemaName);

    var properties = Object.getOwnPropertyNames(schDef.properties);

    if (schDef.order.length !== properties.length) {
      throw new SyntaxError("The length of order should be equal to properties. Definition: ".concat(JSON.stringify(schema, null, 4)));
    }

    schDef.order.forEach(function (field) {
      if (properties.indexOf(field) === -1) {
        throw new SyntaxError("The properties doesn't contains '".concat(field, "' field in order. Definition: ").concat(JSON.stringify(schema, null, 4)));
      }
    });
    schDef.order.forEach(function (name) {
      var prop = schDef.properties[name];

      if (!(prop instanceof Object)) {
        throw new TypeError('Invalid schema definition');
      }

      if (typeof prop.type !== 'string') {
        throw new SyntaxError("Schema definition requires valid 'type' field.");
      }

      var typeLowerCase = prop.type.toLowerCase();
      debug("_compileSchemaObject schemaName: ".concat(schemaName, ", schDef.name: ").concat(schDef.name, ", name: ").concat(name, " type: ").concat(typeLowerCase));

      if (typeLowerCase === 'object') {
        var nestSchemaName = "".concat(schemaName, "_").concat(name, "_obj");

        _this._compileSchemaObject(nestSchemaName, prop);

        schemaInstance.addField(name, BufferPlus.getSchema(nestSchemaName));
      } else if (typeLowerCase === 'array') {
        _this._compileSchemaArray(schemaName, name, prop);
      } else if (typeLowerCase === 'schema') {
        var nestSchema = BufferPlus.getSchema(prop.name);
        nestSchema.buildOnce();
        schemaInstance.addField(name, nestSchema);
      } else if (typeLowerCase === 'custom') {
        if (typeof prop.name !== 'string') {
          throw new SyntaxError("Custom type requires 'name' field.");
        }

        schemaInstance.addField(name, prop.name);
      } else if (READ_BUILTIN_TYPES.hasOwnProperty(typeLowerCase)) {
        schemaInstance.addField(name, prop.type);
      }
    });
  }

  buildOnce() {
    var needBuildSchema = this._schemaDef && !this._buildSchema;

    if (!this._buildOnce || needBuildSchema) {
      if (needBuildSchema) {
        debug('_schemaDef:', this._schemaDef);

        var schemaType = this._schemaDef.type.toLowerCase();

        if (schemaType === 'object') {
          this._compileSchemaObject(this.name, this._schemaDef);
        } else if (schemaType === 'array') {
          this._compileSchemaArray(this.name, null, this._schemaDef);
        } else {
          throw new TypeError("Invalid schema type property: ".concat(schemaType));
        }

        this._buildSchema = true;
      }

      this.build();
      this._buildOnce = true;
    }
  }

  build() {
    var decodeFuncStr = this._buildDecodeFuncStr();

    var encodeFuncStr = this._buildEncodeFuncStr();

    var byteLengthFuncStr = this._buildByteLengthFuncStr();

    this._decodeFunc = new Function('rBuffer', 'helper', decodeFuncStr);
    this._encodeFunc = new Function('wBuffer', 'json', 'helper', encodeFuncStr);
    this._byteLengthFunc = new Function('json', 'helper', byteLengthFuncStr);

    if (process.env.NODE_DEBUG === 'bp') {
      var prettier = require('prettier-eslint');

      var path = require('path');

      var eslintrc = path.resolve(__dirname, '..', '.eslintrc.js');

      var funcPrettier = function funcPrettier(src) {
        return prettier({
          text: src,
          filePath: eslintrc
        });
      };

      var prettyDecodeFunc = funcPrettier(decodeFuncStr);
      var prettyEncodeFunc = funcPrettier(encodeFuncStr);
      var prettyByteLengthFunc = funcPrettier(byteLengthFuncStr);
      this._decodeFunc = new Function('rBuffer', 'helper', prettyDecodeFunc);
      this._encodeFunc = new Function('wBuffer', 'json', 'helper', prettyEncodeFunc);
      this._byteLengthFunc = new Function('json', 'helper', prettyByteLengthFunc);
      debug('_decodeFunc:\n', this._decodeFunc.toString());
      debug('_encodeFunc:\n', this._encodeFunc.toString());
      debug('_byteLengthFunc:\n', this._byteLengthFunc.toString());
    }
  }

  getDecodeNameFuncStr(funcName) {
    var decodeFuncStr = this._buildDecodeFuncStr(true);

    return "var ".concat(funcName, " = function (buffer, helper) {").concat(decodeFuncStr, "};");
  }

  getEncodeNameFuncStr(funcName) {
    var encodeFuncStr = this._buildEncodeFuncStr(true);

    return "var ".concat(funcName, " = function (buffer, json, helper) {").concat(encodeFuncStr, "};");
  }

  getByteLengthNameFuncStr(funcName) {
    var byteLengthFuncStr = this._buildByteLengthFuncStr(true);

    return "var ".concat(funcName, " = function (json, helper) {").concat(byteLengthFuncStr, "};");
  }

  _addRefVal(assignVal) {
    var refVal = "ref".concat(this._refIndex);
    this._refIndex++;

    this._refCtx.push("var ".concat(refVal, " = ").concat(assignVal, ";"));

    return refVal;
  }

  _compactFuncStr(array) {
    var trimArray = array.map(function (item) {
      if (typeof item !== 'string') {
        return '';
      }

      var result = '';
      item.trim().split('\n').forEach(function (line) {
        result += line.trim();
      });
      return result;
    });
    return trimArray.join('');
  }

  _buildDecodeFuncStr(inner) {
    var rootPrefix = inner ? [] : ['var buffer = rBuffer.getRemainingBuffer();', 'helper.offset = 0;'];
    var decodePrefixs = ["var strEnc = '".concat(this._encoding, "';"), 'var data = {};'];
    var decodeSuffixs = [inner ? '' : 'rBuffer._forceSkipTo(helper.offset);', 'return data;'];

    for (var name in this._decodeInnerFuncs) {
      if (Object.prototype.hasOwnProperty.call(this._decodeInnerFuncs, name)) {
        decodePrefixs.unshift(this._decodeInnerFuncs[name]);
      }
    }

    return this._compactFuncStr(rootPrefix.concat(decodePrefixs, this._decodeCtx, decodeSuffixs));
  }

  _buildEncodeFuncStr(inner) {
    var encodePrefixs = [inner ? [] : "var strEnc = '".concat(this._encoding, "';")];
    var encodeSuffixs = [inner ? '' : 'wBuffer._forceOffset(helper.offset);'];

    for (var name in this._encodeInnerFuncs) {
      if (Object.prototype.hasOwnProperty.call(this._encodeInnerFuncs, name)) {
        encodePrefixs.unshift(this._encodeInnerFuncs[name]);
      }
    }

    for (var _name in this._byteLengthInnerFuncs) {
      if (Object.prototype.hasOwnProperty.call(this._byteLengthInnerFuncs, _name)) {
        encodePrefixs.unshift(this._byteLengthInnerFuncs[_name]);
      }
    }

    return this._compactFuncStr(encodePrefixs.concat(this._refCtx, inner ? [] : 'helper.offset = 0;', inner ? [] : 'var byteCount = 0;', inner ? [] : this._byteLengthCtx, inner ? [] : "wBuffer._ensureWriteSize(byteCount);", inner ? [] : "var buffer = wBuffer._buf.slice(wBuffer._pos, wBuffer._len);", this._encodeCtx, encodeSuffixs));
  }

  _buildByteLengthFuncStr(inner) {
    var prefixs = ["var strEnc = '".concat(this._encoding, "';"), 'var byteCount = 0;'];
    var suffixs = ['return byteCount;'];

    for (var name in this._byteLengthInnerFuncs) {
      if (Object.prototype.hasOwnProperty.call(this._byteLengthInnerFuncs, name)) {
        prefixs.unshift(this._byteLengthInnerFuncs[name]);
      }
    }

    return this._compactFuncStr(prefixs.concat(this._refCtx, this._byteLengthCtx, suffixs));
  }

}

function readBoolean(buffer) {
  var value = buffer.readUInt8(helper.offset);
  helper.offset += 1;
  return value ? true : false;
}

function writeBoolean(buffer, value) {
  helper.offset = buffer.writeUInt8(value ? 1 : 0, helper.offset);
}

function readInt64BE(buffer) {
  var value = new Int64BE(buffer.slice(helper.offset, helper.offset + 8));
  helper.offset += 8;
  return value.toNumber();
}

function readInt64LE(buffer) {
  var value = new Int64LE(buffer.slice(helper.offset, helper.offset + 8));
  helper.offset += 8;
  return value.toNumber();
}

function readUInt64BE(buffer) {
  var value = new UInt64BE(buffer.slice(helper.offset, helper.offset + 8));
  helper.offset += 8;
  return value.toNumber();
}

function readUInt64LE(buffer) {
  var value = new UInt64LE(buffer.slice(helper.offset, helper.offset + 8));
  helper.offset += 8;
  return value.toNumber();
}

function writeInt64BE(buffer, value) {
  var int64 = new Int64BE(value);
  int64.toBuffer().copy(buffer, helper.offset, 0, 8);
  helper.offset += 8;
}

function writeInt64LE(buffer, value) {
  var int64 = new Int64LE(value);
  int64.toBuffer().copy(buffer, helper.offset, 0, 8);
  helper.offset += 8;
}

function writeUInt64BE(buffer, value) {
  var int64 = new UInt64BE(value);
  int64.toBuffer().copy(buffer, helper.offset, 0, 8);
  helper.offset += 8;
}

function writeUInt64LE(buffer, value) {
  var int64 = new UInt64LE(value);
  int64.toBuffer().copy(buffer, helper.offset, 0, 8);
  helper.offset += 8;
}

function readVarUInt(buffer) {
  var val = 0;
  var shift = 0;
  var byte;

  do {
    byte = buffer[helper.offset++];
    val += shift < 28 ? (byte & 0x7F) << shift : (byte & 0x7F) * Math.pow(2, shift);
    shift += 7;
  } while (byte & 0x80);

  return val;
}

function writeVarUInt(buffer, valueArg) {
  var value = valueArg;

  while (value >= 2147483648) {
    buffer[helper.offset++] = value & 0xFF | 0x80;
    value /= 128;
  }

  while (value > 127) {
    buffer[helper.offset++] = value & 0xFF | 0x80;
    value >>>= 7;
  }

  buffer[helper.offset++] = value | 0;
}

function readVarInt(buffer) {
  var val = readVarUInt(buffer);
  return val & 1 ? (val + 1) / -2 : val / 2;
}

function writeVarInt(buffer, value) {
  var val = value >= 0 ? value * 2 : value * -2 - 1;
  writeVarUInt(buffer, val);
}

function readString(buffer, strEnc) {
  var len = readVarUInt(buffer);
  var str = buffer.toString(strEnc, helper.offset, helper.offset + len);
  helper.offset += len;
  return str;
}

function writeString(buffer, value, encoding) {
  var len = Buffer.byteLength(value, encoding);
  writeVarUInt(buffer, len);
  buffer.write(value, helper.offset, len, encoding);
  helper.offset += len;
}

function readBuffer(buffer) {
  var len = readVarUInt(buffer);
  var buf = buffer.slice(helper.offset, helper.offset + len);
  helper.offset += len;
  return buf;
}

function writeBuffer(buffer, value) {
  var len = value.len;
  writeVarUInt(buffer, len);
  value.copy(buffer, helper.offset);
  helper.offset += len;
}

helper = {
  offset: 0,
  getDataTypeByteLength: BufferPlus._getDataTypeByteLength,
  readBoolean: readBoolean,
  writeBoolean: writeBoolean,
  readInt64BE: readInt64BE,
  readInt64LE: readInt64LE,
  readUInt64BE: readUInt64BE,
  readUInt64LE: readUInt64LE,
  writeInt64BE: writeInt64BE,
  writeInt64LE: writeInt64LE,
  writeUInt64BE: writeUInt64BE,
  writeUInt64LE: writeUInt64LE,
  readVarInt: readVarInt,
  writeVarInt: writeVarInt,
  readVarUInt: readVarUInt,
  writeVarUInt: writeVarUInt,
  readString: readString,
  writeString: writeString,
  readBuffer: readBuffer,
  writeBuffer: writeBuffer,
  byteLengthString: function byteLengthString(value, encoding) {
    var len = Buffer.byteLength(value, encoding);
    return VarInt.byteLengthUInt(len) + len;
  },
  byteLengthBuffer: function byteLengthBuffer(value) {
    var len = value.length;
    return VarInt.byteLengthUInt(len) + len;
  },
  byteLengthVarInt: function byteLengthVarInt(value) {
    return VarInt.byteLengthInt(value);
  },
  byteLengthVarUInt: function byteLengthVarUInt(value) {
    return VarInt.byteLengthUInt(value);
  },
  readCustomType: function readCustomType(bp, dataType) {
    var funcMap = BufferPlus._getTypeFuncMap(dataType);

    var oriPos = bp.position;
    bp.moveTo(helper.offset + bp.position);
    var result = funcMap.read.call(bp);
    bp.moveTo(oriPos);
    var size = funcMap.size.call(bp, result);
    helper.offset += size;
    return result;
  },
  writeCustomType: function writeCustomType(bp, dataType, data) {
    var funcMap = BufferPlus._getTypeFuncMap(dataType);

    var size = funcMap.size.call(bp, data);
    var oriPos = bp.position;
    bp.moveTo(helper.offset + bp.position);
    funcMap.write.call(bp, data);
    bp.moveTo(oriPos);
    helper.offset += size;
  },
  sizeCustomType: function sizeCustomType(dataType, data) {
    var funcMap = BufferPlus._getTypeFuncMap(dataType);

    return funcMap.size.call(null, data);
  }
};
module.exports = BufferSchema;