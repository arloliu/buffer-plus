'use strict';
/* eslint-disable quotes */
/* eslint-disable no-new-func */

const BufferPlus = require('./BufferPlus.js');
const Int64BE = require('int64-buffer').Int64BE;
const Int64LE = require('int64-buffer').Int64LE;
const UInt64BE = require('int64-buffer').Uint64BE;
const UInt64LE = require('int64-buffer').Uint64LE;
const VarInt = require('./VarInt.js');

// eslint-disable-next-line no-unused-vars
const nodeUtil = require('util');
// eslint-disable-next-line no-unused-vars
const debug = (nodeUtil && nodeUtil.debuglog) ? nodeUtil.debuglog('bp') : function() {};

// Declare helper first
let helper = {};

const ObjectRequiredFields = ['type', 'properties'];
const ArrayRequiredFields = ['type', 'items'];

const READ_BUILTIN_TYPES = {
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
    'buffer': 'helper.readBuffer(buffer);',
};

function isReadBuiltinTypes(type) {
    return READ_BUILTIN_TYPES.hasOwnProperty(type.toLowerCase());
}

let _iterIndex = 1;
let _arrayValIndex = 1;

function getIterStr() {
    const iter = `j${_iterIndex}`;
    _iterIndex++;
    return iter;
}

function getArrayValStr() {
    const val = `arrLen${_arrayValIndex}`;
    _arrayValIndex++;
    return val;
}

function _genWriteStr(funcName, valueStr) {
    return `helper.offset = buffer.write${funcName}(${valueStr}, helper.offset);`;
}

function isObject(obj) {
    const type = typeof obj;
    return type === 'function' || (type === 'object' && !!obj);
};

function getBuiltinWriteString(dataType, valueStr) {
    switch (dataType) {
        case 'bool': return `helper.writeBoolean(buffer, ${valueStr} ? 1 : 0);`;
        case 'boolean': return `helper.writeBoolean(buffer, ${valueStr} ? 1 : 0);`;
        case 'int8': return _genWriteStr('Int8', valueStr);
        case 'int16be': return _genWriteStr('Int16BE', valueStr);
        case 'int16le': return _genWriteStr('Int16LE', valueStr);
        case 'int32be': return _genWriteStr('Int32BE', valueStr);
        case 'int32le': return _genWriteStr('Int32LE', valueStr);
        case 'int64be': return `helper.writeInt64BE(buffer, ${valueStr});`;
        case 'int64le': return `helper.writeInt64LE(buffer, ${valueStr});`;

        case 'uint8': return _genWriteStr('UInt8', valueStr);
        case 'uint16be': return _genWriteStr('UInt16BE', valueStr);
        case 'uint16le': return _genWriteStr('UInt16LE', valueStr);
        case 'uint32be': return _genWriteStr('UInt32BE', valueStr);
        case 'uint32le': return _genWriteStr('UInt32LE', valueStr);
        case 'uint64be': return `helper.writeUInt64BE(buffer, ${valueStr});`;
        case 'uint64le': return `helper.writeUInt64LE(buffer, ${valueStr});`;

        case 'floatbe': return _genWriteStr('FloatBE', valueStr);
        case 'floatle': return _genWriteStr('FloatLE', valueStr);
        case 'float32be': return _genWriteStr('FloatBE', valueStr);
        case 'float32le': return _genWriteStr('FloatLE', valueStr);
        case 'doublebe': return _genWriteStr('DoubleBE', valueStr);
        case 'doublele': return _genWriteStr('DoubleLE', valueStr);
        case 'float64be': return _genWriteStr('DoubleBE', valueStr);
        case 'float64le': return _genWriteStr('DoubleLE', valueStr);

        case 'varuint': return `helper.writeVarUInt(buffer, ${valueStr});`;
        case 'varint': return `helper.writeVarInt(buffer, ${valueStr});`;

        case 'string': return `helper.writeString(buffer, ${valueStr}, strEnc);`;
        case 'buffer': return `helper.writeBuffer(buffer, ${valueStr});`;
    }
    return undefined;
}

function getBuiltinReadString(dataType, valueStr) {
    return valueStr + ' = ' + READ_BUILTIN_TYPES[dataType];
}

function getBuiltinSizeString(dataType, valueStr) {
    const funcMap = BufferPlus._getTypeFuncMap(dataType);
    if (!funcMap || !funcMap.size) {
        return '';
    }
    if (typeof funcMap.size === 'number') {
        return `byteCount += ${funcMap.size};`;
    }

    switch (dataType.toLowerCase()) {
        case 'string':
            return `byteCount += helper.byteLengthString(${valueStr}, strEnc);`;
        case 'buffer':
            return `byteCount += helper.byteLengthBuffer(${valueStr}, strEnc);`;
        case 'varint':
            return `byteCount += helper.byteLengthVarInt(${valueStr});`;
        case 'varuint':
            return `byteCount += helper.byteLengthVarUInt(${valueStr});`;
    }
    return `byteCount += helper.getDataTypeByteLength(${valueStr}, '${dataType}', strEnc);`;
}

function getDataTypeFunctionString(type, readObjStrArg, writeObjStrArg) {
    const dataType = type.trim();
    const typeLowerCase = dataType.toLowerCase();
    const readObjStr = readObjStrArg.trim();
    const writeObjStr = writeObjStrArg.trim();

    // case insensitive
    if (isReadBuiltinTypes(dataType)) {
        return {
            read: getBuiltinReadString(typeLowerCase, readObjStr),
            write: getBuiltinWriteString(typeLowerCase, writeObjStr),
            size: getBuiltinSizeString(dataType, writeObjStr),
        };
    } else if (BufferPlus.hasCustomType(dataType)) {
        // case sensitive
        return {
            read: `${readObjStr} = helper.readCustomType(rBuffer, '${dataType}');`,
            write: `helper.writeCustomType(wBuffer, '${dataType}', ${writeObjStr});`,
            // size: getBuiltinSizeString(dataType, writeObjStr),
            size: `byteCount += helper.sizeCustomType('${dataType}', ${writeObjStr});`,
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

        this._encodeFunc = function(a1, a2, a3) {
            throw new Error('Not implemented.');
        };

        this._decodeFunc = function(a1, a2) {
            throw new Error('Not implemented.');
        };

        this._byteLengthFunc = function(a1, a2) {
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
        const dataTypeStr = (dataType instanceof BufferSchema) ? `Schema.${dataType.name}` : dataType;
        debug(`addField('${key}', '${dataTypeStr}') - Schema: ${this.name}`);

        let funcStr;
        let readObjStr;
        let writeObjStr;

        if (typeof key !== 'string') {
            readObjStr = 'data';
            writeObjStr = 'json';
        } else {
            const dataKey = key.trim();
            readObjStr = `data['${dataKey}']`;
            writeObjStr = `json['${dataKey}']`;
        }

        if (dataType instanceof BufferSchema) {
            const schema = dataType;
            const funcName = `Schema${schema.name}`;

            this._decodeInnerFuncs[schema.name] = schema.getDecodeNameFuncStr(`_read${funcName}`);
            this._encodeInnerFuncs[schema.name] = schema.getEncodeNameFuncStr(`_write${funcName}`);
            this._byteLengthInnerFuncs[schema.name] = schema.getByteLengthNameFuncStr(`_byteLength${funcName}`);
            funcStr = {
                read: `data.${key} = _read${funcName}(buffer, helper);`,
                write: `_write${funcName}(buffer, ${writeObjStr}, helper);`,
                size: `byteCount += _byteLength${funcName}(${writeObjStr}, helper);`,
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
        const dataTypeStr = (dataType instanceof BufferSchema) ? `Schema.${dataType.name}` : dataType;
        debug(`addArrayField('${key}', '${dataTypeStr}') - Schema: ${this.name}`);

        let readItem;
        let writeItem;

        if (typeof key !== 'string') {
            readItem = `data`;
            writeItem = this._addRefVal(`json`);
        } else {
            const refKey = key.trim();
            readItem = `data['${refKey}']`;
            writeItem = this._addRefVal(`json['${refKey}']`);
        }

        const arrayLenVal = getArrayValStr();
        const arrayIter = getIterStr();
        const readObjStr = `${readItem}[${arrayIter}]`;
        const writeObjStr = `${writeItem}[${arrayIter}]`;

        const arrayLenVal2 = getArrayValStr();
        const arrayIter2 = getIterStr();
        const writeObjStr2 = `${writeItem}[${arrayIter2}]`;

        let funcStr;
        let sizeFuncStr;

        if (dataType instanceof BufferSchema) {
            const schema = dataType;
            const schemaName = `Schema${schema.name}`;
            this._decodeInnerFuncs[schema.name] = schema.getDecodeNameFuncStr(`_read${schemaName}`);
            this._encodeInnerFuncs[schema.name] = schema.getEncodeNameFuncStr(`_write${schemaName}`);
            this._byteLengthInnerFuncs[schema.name] = schema.getByteLengthNameFuncStr(`_byteLength${schemaName}`);

            funcStr = {
                read: `${readObjStr} = _read${schemaName}(buffer, helper);`,
                write: `_write${schemaName}(buffer, ${writeObjStr}, helper)`,
            };
            sizeFuncStr = `byteCount += _byteLength${schemaName}(${writeObjStr2}, helper);`;
        } else {
            funcStr = getDataTypeFunctionString(dataType, readObjStr, writeObjStr);
            sizeFuncStr = getBuiltinSizeString(dataType, writeObjStr2);
        }

        this._decodeCtx.push(`
            var ${arrayLenVal} = helper.readVarUInt(buffer);
            ${readItem} = [];
            for (var ${arrayIter} = 0; ${arrayIter} < ${arrayLenVal}; ${arrayIter}++) {
                ${funcStr.read}
            }
        `);

        this._encodeCtx.push(`
            var ${arrayLenVal} = ${writeItem}.length;
            helper.writeVarUInt(buffer, ${arrayLenVal});
            for (var ${arrayIter} = 0; ${arrayIter} < ${arrayLenVal}; ${arrayIter}++) {
                ${funcStr.write}
            }
        `);

        this._byteLengthCtx.push(`
            var ${arrayLenVal2} = ${writeItem}.length;
            byteCount += helper.byteLengthVarUInt(${arrayLenVal2});
            for (var ${arrayIter2} = 0; ${arrayIter2} < ${arrayLenVal2}; ${arrayIter2}++) {
                ${sizeFuncStr}
            }
        `);

        this._buildOnce = false;

        return this;
    }

    _getSchemaInstance(name) {
        if (BufferPlus.hasSchema(name)) {
            return BufferPlus.getSchema(name);
        } else {
            const schema = new BufferSchema(name);
            BufferPlus._registerSchema(name, schema);
            return schema;
        }
    }

    _compileSchemaArray(schemaName, name, schDef) {
        if (!isObject(schDef)) {
            throw new TypeError('Invalid schema definition');
        }

        if (typeof schDef.type !== 'string') {
            throw new SyntaxError(`Schema definition requires valid 'type' field.`);
        }

        const schemaInstance = this._getSchemaInstance(schemaName);
        const typeLowerCase = schDef.type.toLowerCase();

        debug(`_compileSchemaArray schemaName: ${schemaName}, schDef.name: ${schDef.name}, name: ${name} type: ${typeLowerCase}`);
        if (typeLowerCase === 'object') {
            this._compileSchemaObject(schemaName, schDef);
        } else if (typeLowerCase === 'schema') {
            const nestSchema = BufferPlus.getSchema(schDef.name);
            this._compileSchemaObject(schemaName, nestSchema._schemaDef);
        } else if (typeLowerCase === 'custom') {
            schemaInstance.addField(name, schDef.name);
        } else if (typeLowerCase === 'array') {
            ArrayRequiredFields.forEach((field) => {
                if (!schDef.hasOwnProperty(field)) {
                    throw new SyntaxError(`Schema definition requires '${field}' field. definition: \n${JSON.stringify(schema, null, 4)}`);
                }
            });

            const nestSchemaName = name ? `${schemaName}_${name}` : `${schemaName}_nested`;
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
        debug(`== _compileSchemaObject: schemaName: ${schemaName}`);
        if (!isObject(schDef)) {
            throw new TypeError('Invalid schema definition' + JSON.stringify(schema));
        }

        if (schDef.type !== 'object') {
            throw new TypeError('Type of schema definition should be object');
        }

        ObjectRequiredFields.forEach((field) => {
            if (!schDef.hasOwnProperty(field)) {
                throw new SyntaxError(`Schema definition requires '${field}' field.`);
            }
        });

        if (!isObject(schDef.properties)) {
            throw new TypeError('type of "properties" property within schema definition must be object.');
        }

        // build order property if not defined
        if (schDef.order === undefined) {
            schDef.order = [];
            const names = Object.getOwnPropertyNames(schDef.properties);
            for (const name of names) {
                if (schDef.properties.hasOwnProperty(name)) {
                    schDef.order.push(name);
                }
            }
        }

        if (!Array.isArray(schDef.order)) {
            throw new TypeError('type of order property within schema definition must be array.');
        }

        const schemaInstance = this._getSchemaInstance(schemaName);
        const properties = Object.getOwnPropertyNames(schDef.properties);

        if (schDef.order.length !== properties.length) {
            throw new SyntaxError(`The length of order should be equal to properties. Definition: ${JSON.stringify(schema, null, 4)}`);
        }

        schDef.order.forEach((field) => {
            if (properties.indexOf(field) === -1) {
                throw new SyntaxError(`The properties doesn't contains '${field}' field in order. Definition: ${JSON.stringify(schema, null, 4)}`);
            }
        });

        schDef.order.forEach((name) => {
            const prop = schDef.properties[name];

            if (!(prop instanceof Object)) {
                throw new TypeError('Invalid schema definition');
            }
            if (typeof prop.type !== 'string') {
                throw new SyntaxError(`Schema definition requires valid 'type' field.`);
            }

            const typeLowerCase = prop.type.toLowerCase();
            debug(`_compileSchemaObject schemaName: ${schemaName}, schDef.name: ${schDef.name}, name: ${name} type: ${typeLowerCase}`);
            if (typeLowerCase === 'object') {
                const nestSchemaName = `${schemaName}_${name}_obj`;
                this._compileSchemaObject(nestSchemaName, prop);
                schemaInstance.addField(name, BufferPlus.getSchema(nestSchemaName));
            } else if (typeLowerCase === 'array') {
                this._compileSchemaArray(schemaName, name, prop);
            } else if (typeLowerCase === 'schema') {
                const nestSchema = BufferPlus.getSchema(prop.name);
                nestSchema.buildOnce();
                schemaInstance.addField(name, nestSchema);
            } else if (typeLowerCase === 'custom') {
                if (typeof prop.name !== 'string') {
                    throw new SyntaxError(`Custom type requires 'name' field.`);
                }
                schemaInstance.addField(name, prop.name);
            } else if (READ_BUILTIN_TYPES.hasOwnProperty(typeLowerCase)) {
                schemaInstance.addField(name, prop.type);
            }
        });
    }

    buildOnce() {
        const needBuildSchema = (this._schemaDef && !this._buildSchema);
        if (!this._buildOnce || needBuildSchema) {
            if (needBuildSchema) {
                debug('_schemaDef:', this._schemaDef);
                const schemaType = this._schemaDef.type.toLowerCase();
                if (schemaType === 'object') {
                    this._compileSchemaObject(this.name, this._schemaDef);
                } else if (schemaType === 'array') {
                    this._compileSchemaArray(this.name, null, this._schemaDef);
                } else {
                    throw new TypeError(`Invalid schema type property: ${schemaType}`);
                }
                this._buildSchema = true;
            }
            this.build();
            this._buildOnce = true;
        }
    }

    build() {
        const decodeFuncStr = this._buildDecodeFuncStr();
        const encodeFuncStr = this._buildEncodeFuncStr();
        const byteLengthFuncStr = this._buildByteLengthFuncStr();

        this._decodeFunc = new Function('rBuffer', 'helper', decodeFuncStr);
        this._encodeFunc = new Function('wBuffer', 'json', 'helper', encodeFuncStr);
        this._byteLengthFunc = new Function('json', 'helper', byteLengthFuncStr);
        if (process.env.NODE_DEBUG === 'bp') {
            const prettier = require('prettier-eslint');
            const path = require('path');
            const eslintrc = path.resolve(__dirname, '..', '.eslintrc.js');

            const funcPrettier = (src) => {
                return prettier({text: src, filePath: eslintrc});
            };
            const prettyDecodeFunc = funcPrettier(decodeFuncStr);
            const prettyEncodeFunc = funcPrettier(encodeFuncStr);
            const prettyByteLengthFunc = funcPrettier(byteLengthFuncStr);
            this._decodeFunc = new Function('rBuffer', 'helper', prettyDecodeFunc);
            this._encodeFunc = new Function('wBuffer', 'json', 'helper', prettyEncodeFunc);
            this._byteLengthFunc = new Function('json', 'helper', prettyByteLengthFunc);

            debug('_decodeFunc:\n', this._decodeFunc.toString());
            debug('_encodeFunc:\n', this._encodeFunc.toString());
            debug('_byteLengthFunc:\n', this._byteLengthFunc.toString());
        }
    }

    getDecodeNameFuncStr(funcName) {
        const decodeFuncStr = this._buildDecodeFuncStr(true);
        return `var ${funcName} = function (buffer, helper) {${decodeFuncStr}};`;
    }

    getEncodeNameFuncStr(funcName) {
        const encodeFuncStr = this._buildEncodeFuncStr(true);
        return `var ${funcName} = function (buffer, json, helper) {${encodeFuncStr}};`;
    }

    getByteLengthNameFuncStr(funcName) {
        const byteLengthFuncStr = this._buildByteLengthFuncStr(true);
        return `var ${funcName} = function (json, helper) {${byteLengthFuncStr}};`;
    }

    _addRefVal(assignVal) {
        const refVal = `ref${this._refIndex}`;
        this._refIndex++;
        this._refCtx.push(`var ${refVal} = ${assignVal};`);
        return refVal;
    }

    _compactFuncStr(array) {
        // debug('\n\n###############\n' + array.join('\n'));
        const trimArray = array.map((item) => {
            if (typeof item !== 'string') {
                return '';
            }

            let result = '';
            item.trim().split('\n').forEach((line) => {
                result += line.trim();
            });
            return result;
        });
        return trimArray.join('');
    }

    _buildDecodeFuncStr(inner) {
        const rootPrefix = inner ? [] : [
            'var buffer = rBuffer.getRemainingBuffer();',
            'helper.offset = 0;',
        ];
        const decodePrefixs = [
            `var strEnc = '${this._encoding}';`,
            'var data = {};',
        ];
        const decodeSuffixs = [
            inner ? '' : 'rBuffer._forceSkipTo(helper.offset);',
            'return data;',
        ];

        for (const name in this._decodeInnerFuncs) {
            if (Object.prototype.hasOwnProperty.call(this._decodeInnerFuncs, name)) {
                decodePrefixs.unshift(this._decodeInnerFuncs[name]);
            }
        }

        return this._compactFuncStr(
            rootPrefix.concat(
                    decodePrefixs,
                this._decodeCtx,
                decodeSuffixs
            )
        );
    }

    _buildEncodeFuncStr(inner) {
        const encodePrefixs = [
            inner ? [] : `var strEnc = '${this._encoding}';`,
        ];
        const encodeSuffixs = [
            inner ? '' : 'wBuffer._forceOffset(helper.offset);',
        ];

        for (const name in this._encodeInnerFuncs) {
            if (Object.prototype.hasOwnProperty.call(this._encodeInnerFuncs, name)) {
                encodePrefixs.unshift(this._encodeInnerFuncs[name]);
            }
        }

        for (const name in this._byteLengthInnerFuncs) {
            if (Object.prototype.hasOwnProperty.call(this._byteLengthInnerFuncs, name)) {
                encodePrefixs.unshift(this._byteLengthInnerFuncs[name]);
            }
        }

        return this._compactFuncStr(
            encodePrefixs.concat(
                this._refCtx,
                inner ? [] : 'helper.offset = 0;',
                inner ? [] : 'var byteCount = 0;',
                inner ? [] : this._byteLengthCtx,
                inner ? [] : `wBuffer._ensureWriteSize(byteCount);`,
                inner ? [] : `var buffer = wBuffer._buf.slice(wBuffer._pos, wBuffer._len);`,
                this._encodeCtx,
                encodeSuffixs
            )
        );
    }

    _buildByteLengthFuncStr(inner) {
        const prefixs = [
            // 'if (!json instanceof Object) throw new TypeError("Invalid json data for encoder");',
            `var strEnc = '${this._encoding}';`,
            'var byteCount = 0;',
        ];
        const suffixs = [
            'return byteCount;',
        ];

        for (const name in this._byteLengthInnerFuncs) {
            if (Object.prototype.hasOwnProperty.call(this._byteLengthInnerFuncs, name)) {
                prefixs.unshift(this._byteLengthInnerFuncs[name]);
            }
        }

        return this._compactFuncStr(
            prefixs.concat(
                this._refCtx,
                this._byteLengthCtx,
                suffixs
            )
        );
    }
} // class BufferSchema

// helper read/write Boolean

function readBoolean(buffer) {
    const value = buffer.readUInt8(helper.offset);
    helper.offset += 1;
    return value ? true : false;
}

function writeBoolean(buffer, value) {
    helper.offset = buffer.writeUInt8(value ? 1 : 0, helper.offset);
}

// helper read/write Int64
function readInt64BE(buffer) {
    const value = new Int64BE(buffer.slice(helper.offset, helper.offset + 8));
    helper.offset += 8;
    return value.toNumber();
}

function readInt64LE(buffer) {
    const value = new Int64LE(buffer.slice(helper.offset, helper.offset + 8));
    helper.offset += 8;
    return value.toNumber();
}

function readUInt64BE(buffer) {
    const value = new UInt64BE(buffer.slice(helper.offset, helper.offset + 8));
    helper.offset += 8;
    return value.toNumber();
}

function readUInt64LE(buffer) {
    const value = new UInt64LE(buffer.slice(helper.offset, helper.offset + 8));
    helper.offset += 8;
    return value.toNumber();
}

function writeInt64BE(buffer, value) {
    const int64 = new Int64BE(value);
    int64.toBuffer().copy(buffer, helper.offset, 0, 8);
    helper.offset += 8;
}

function writeInt64LE(buffer, value) {
    const int64 = new Int64LE(value);
    int64.toBuffer().copy(buffer, helper.offset, 0, 8);
    helper.offset += 8;
}

function writeUInt64BE(buffer, value) {
    const int64 = new UInt64BE(value);
    int64.toBuffer().copy(buffer, helper.offset, 0, 8);
    helper.offset += 8;
}

function writeUInt64LE(buffer, value) {
    const int64 = new UInt64LE(value);
    int64.toBuffer().copy(buffer, helper.offset, 0, 8);
    helper.offset += 8;
}

// helper read/write var uint
function readVarUInt(buffer) {
    let val = 0;
    let shift = 0;
    let byte;
    do {
        byte = buffer[helper.offset++];
        val += (shift < 28)
            ? (byte & 0x7F) << shift
            : (byte & 0x7F) * Math.pow(2, shift);
        shift += 7;
    }
    while (byte & 0x80);

    return val;
}

function writeVarUInt(buffer, valueArg) {
    let value = valueArg;
    // value >= 2^31
    while (value >= 2147483648) {
        buffer[helper.offset++] = (value & 0xFF) | 0x80;
        value /= 128;
    }

    while (value > 127) {
        buffer[helper.offset++] = (value & 0xFF) | 0x80;
        value >>>= 7;
    }
    buffer[helper.offset++] = value | 0;
}

// helper read/write var int
function readVarInt(buffer) {
    const val = readVarUInt(buffer);
    return (val & 1) ? (val + 1) / -2 : val / 2;
}

function writeVarInt(buffer, value) {
    const val = value >= 0 ? value * 2 : (value * -2) - 1;
    writeVarUInt(buffer, val);
}

// helper read/write string
function readString(buffer, strEnc) {
    const len = readVarUInt(buffer);
    const str = buffer.toString(strEnc, helper.offset, helper.offset + len);
    helper.offset += len;
    return str;
}

function writeString(buffer, value, encoding) {
    const len = Buffer.byteLength(value, encoding);
    writeVarUInt(buffer, len);
    buffer.write(value, helper.offset, len, encoding);
    helper.offset += len;
}

// helper read/write Buffer
function readBuffer(buffer) {
    const len = readVarUInt(buffer);
    const buf = buffer.slice(helper.offset, helper.offset + len);
    helper.offset += len;
    return buf;
}

function writeBuffer(buffer, value) {
    const len = value.len;
    writeVarUInt(buffer, len);
    value.copy(buffer, helper.offset);
    helper.offset += len;
}

// define helper here
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

    byteLengthString: function(value, encoding) {
        const len = Buffer.byteLength(value, encoding);
        return VarInt.byteLengthUInt(len) + len;
    },

    byteLengthBuffer: function(value) {
        const len = value.length;
        return VarInt.byteLengthUInt(len) + len;
    },

    byteLengthVarInt: function(value) {
        return VarInt.byteLengthInt(value);
    },

    byteLengthVarUInt: function(value) {
        return VarInt.byteLengthUInt(value);
    },

    readCustomType: function(bp, dataType) {
        const funcMap = BufferPlus._getTypeFuncMap(dataType);

        // const tempBp = new BufferPlus(bp);
        // tempBp.moveTo(helper.offset + bp.position);
        // const result = funcMap.read.call(tempBp);
        // const size = funcMap.size.call(tempBp, result);

        const oriPos = bp.position;
        bp.moveTo(helper.offset + bp.position);
        const result = funcMap.read.call(bp);
        bp.moveTo(oriPos);
        const size = funcMap.size.call(bp, result);

        helper.offset += size;
        return result;
    },

    writeCustomType: function(bp, dataType, data) {
        const funcMap = BufferPlus._getTypeFuncMap(dataType);
        const size = funcMap.size.call(bp, data);

        // const tempBp = new BufferPlus(size);
        // funcMap.write.call(tempBp, data);
        // tempBp.toBuffer().copy(bp._buf, helper.offset + bp.position);

        const oriPos = bp.position;
        bp.moveTo(helper.offset + bp.position);
        funcMap.write.call(bp, data);
        bp.moveTo(oriPos);

        helper.offset += size;
    },

    sizeCustomType: function(dataType, data) {
        const funcMap = BufferPlus._getTypeFuncMap(dataType);
        return funcMap.size.call(null, data);
    },
};

module.exports = BufferSchema;
