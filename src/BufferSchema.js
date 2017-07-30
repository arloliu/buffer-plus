'use strict';
/* eslint-disable quotes */
/* eslint-disable no-new-func */

const BufferPlus = require('./BufferPlus.js');
const VarInt = require('./VarInt.js');
// eslint-disable-next-line no-unused-vars
const debug = require('util').debuglog('bp');

const MSB_BYTES = ~(0x7F);


class BufferSchema
{
    constructor(name)
    {
        this.name = name;
        this._encoding = 'utf8';

        this._decodeCtx = [];
        this._decodeInnerFuncs = {};

        this._encodeCtx = [];
        this._encodeInnerFuncs = {};

        this._byteLengthCtx = [];
        this._byteLengthInnerFuncs = {};

        this._encodeFunc = function(buffer, json, schema) {
            throw new Error('Not implemented.');
        };

        this._decodeFunc = function(buffer, schema) {
            throw new Error('Not implemented.');
        };

        this._byteLengthFunc = function(json, schema) {
            throw new Error('Not implemented.');
        };

    }

    encode(buffer, data)
    {
        this._encodeFunc.call(null, buffer, data, helper);
    }

    decode(buffer)
    {
        return this._decodeFunc.call(null, buffer, helper);
    }

    byteLength(data)
    {
        return this._byteLengthFunc.call(null, data, helper);
    }

    setEncoding(encoding)
    {
        if (!BufferPlus.isEncoding(encoding))
            throw new TypeError('encoding must be a valid string encoding');
        this._encoding = encoding;
    }


    addField(key, dataType)
    {
        let funcStr;
        if (dataType instanceof BufferSchema)
        {
            const schema = dataType;
            const funcName = `Schema${schema.name}`;

            this._decodeInnerFuncs[schema.name] = schema.getDecodeNameFuncStr(`_read${funcName}`);
            this._encodeInnerFuncs[schema.name] = schema.getEncodeNameFuncStr(`_write${funcName}`);
            this._byteLengthInnerFuncs[schema.name] = schema.getByteLengthNameFuncStr(`_byteLength${funcName}`);
            funcStr = {
                read: `data.${key} = _read${funcName}(buffer, schema);`,
                write: `_write${funcName}(buffer, json.${key}, schema);`,
                size: `byteCount += _byteLength${funcName}(json.${key}, schema);`
            };
        }
        else
        {
            funcStr = getDataTypeFunctionString(dataType, key, true);
        }

        this._encodeCtx.push(funcStr.write);
        this._decodeCtx.push(funcStr.read);
        this._byteLengthCtx.push(funcStr.size);

        return this;
    }

    addArrayField(key, dataType)
    {
        key = key.trim();
        const arrayLenVal = `${key}_arr_len`;
        const arrayIter = `${key}_iter`;
        const itemStr = `${key}[${arrayIter}]`;

        const arrayLenVal2 = `${key}_arr_len2`;
        const arrayIter2 = `${key}_iter2`;
        const itemStr2 = `${key}[${arrayIter2}]`;

        let funcStr, funcStr2;

        if (dataType instanceof BufferSchema)
        {
            const schema = dataType;
            const funcName = `Schema${schema.name}`;
            this._decodeInnerFuncs[schema.name] = schema.getDecodeNameFuncStr(`_read${funcName}`);
            this._encodeInnerFuncs[schema.name] = schema.getEncodeNameFuncStr(`_write${funcName}`);
            this._byteLengthInnerFuncs[schema.name] = schema.getByteLengthNameFuncStr(`_byteLength${funcName}`);

            funcStr = {
                read: `data.${itemStr} = _read${funcName}(buffer, schema);`,
                write: `_write${funcName}(buffer, json.${itemStr}, schema)`,
                size: `byteCount += _byteLength${funcName}(json.${itemStr}, schema);`
            };
            funcStr2 = {
                read: `data.${itemStr2} = _read${funcName}(buffer, schema);`,
                write: `_write${funcName}(buffer, json.${itemStr2}, schema)`,
                size: `byteCount += _byteLength${funcName}(json.${itemStr2}, schema);`
            };
        }
        else
        {
            funcStr = getDataTypeFunctionString(dataType, itemStr, true);
            funcStr2 = getDataTypeFunctionString(dataType, itemStr2, true);
        }


        this._decodeCtx.push(`
            let ${arrayLenVal} = buffer.readVarUInt();
            data.${key} = new Array();
            for (let ${arrayIter} = 0; ${arrayIter} < ${arrayLenVal}; ${arrayIter}++) {
                ${funcStr.read}
            }
        `);

        this._encodeCtx.push(`
            let ${arrayLenVal} = json.${key}.length;
            helper.writeVarUInt(buffer, ${arrayLenVal});
            for (let ${arrayIter} = 0; ${arrayIter} < ${arrayLenVal}; ${arrayIter}++) {
                ${funcStr.write}
            }
        `);

        this._byteLengthCtx.push(`
            let ${arrayLenVal2} = json.${key}.length;
            byteCount += helper.byteLengthVarUInt(${arrayLenVal2});
            for (let ${arrayIter2} = 0; ${arrayIter2} < ${arrayLenVal2}; ${arrayIter2}++) {
                ${funcStr2.size}
            }
        `);

        return this;
    }

    buildOnce()
    {
        if (this._buildOnce !== true)
        {
            this.build();
            this._buildOnce = true;
        }
    }

    build()
    {
        const decodeFuncStr = this._buildDecodeFuncStr();
        const encodeFuncStr = this._buildEncodeFuncStr();
        const byteLengthFuncStr = this._buildByteLengthFuncStr();

        this._decodeFunc = new Function('buffer', 'helper', decodeFuncStr);
        this._encodeFunc = new Function('wbuffer', 'json', 'helper', encodeFuncStr);
        this._byteLengthFunc = new Function('json', 'helper', byteLengthFuncStr);
        debug('_decodeFunc:\n', this._decodeFunc.toString());
        debug('_encodeFunc:\n', this._encodeFunc.toString());
        debug('_byteLengthFunc:\n', this._byteLengthFunc.toString());
    }

    getDecodeNameFuncStr(funcName)
    {
        const decodeFuncStr = this._buildDecodeFuncStr();
        return `const ${funcName} = function (buffer, helper) {${decodeFuncStr}};`;
    }

    getEncodeNameFuncStr(funcName)
    {
        const encodeFuncStr = this._buildEncodeFuncStr();
        return `const ${funcName} = function (wbuffer, json, helper) {${encodeFuncStr}};`;
    }

    getByteLengthNameFuncStr(funcName)
    {
        const byteLengthFuncStr = this._buildByteLengthFuncStr();
        return `const ${funcName} = function (json, helper) {${byteLengthFuncStr}};`;
    }



    // proxy method
    _getDataTypeByteLength(value, dataType, encoding)
    {
        return BufferPlus._getDataTypeByteLength(value, dataType, encoding);
    }

    _buildDecodeFuncStr()
    {
        const decodePrefixs = [
            //'if (!buffer instanceof BufferPlus) throw new TypeError("Invalid buffer for decoder");',
            `const strEnc = '${this._encoding}';`,
            'const data = {};'
        ];
        const decodeSuffixs = [
            'return data;'
        ];

        for (let name in this._decodeInnerFuncs)
            decodePrefixs.unshift(this._decodeInnerFuncs[name]);

        return decodePrefixs.concat(
            this._decodeCtx,
            decodeSuffixs
        ).join('\n');
    }

    _buildEncodeFuncStr()
    {
        const encodePrefixs = [
            //'if (!json instanceof Object) throw new TypeError("Invalid json data for encoder");',
            `const strEnc = '${this._encoding}';`,
            'buffer = wbuffer._buf;',
            'helper.offset = 0;',
            'let byteCount = 0;',
            // this.getByteLengthNameFuncStr(`_byteLength`),
            // 'let byteCount = _byteLength(json, helper);',
        ];
        const encodeSuffixs = [
        ];

        for (let name in this._encodeInnerFuncs)
            encodePrefixs.unshift(this._encodeInnerFuncs[name]);

        for (let name in this._byteLengthInnerFuncs)
            encodePrefixs.unshift(this._byteLengthInnerFuncs[name]);

        return encodePrefixs.concat(
            this._byteLengthCtx,
            `wbuffer._ensureWriteSize(byteCount);`,
            this._encodeCtx,
            encodeSuffixs
        ).join('\n');
    }

    _buildByteLengthFuncStr()
    {
        const prefixs = [
            // 'if (!json instanceof Object) throw new TypeError("Invalid json data for encoder");',
            `const strEnc = '${this._encoding}';`,
            'let byteCount = 0;'
        ];
        const suffixs = [
            'return byteCount;'
        ];

        for (let name in this._byteLengthInnerFuncs)
            prefixs.unshift(this._byteLengthInnerFuncs[name]);

        return prefixs.concat(this._byteLengthCtx, suffixs).join('\n');
    }
}

function writeVarUInt(buffer, value)
{
    while (value >= 2147483648) // value >= 2^31
    {
        buffer[helper.offset++] = (value & 0xFF) | 0x80;
        value /= 128;
    }

    while (value > 127)
    {
        buffer[helper.offset++] = (value & 0xFF) | 0x80;
        value >>>= 7;
    }
    buffer[helper.offset++] = value | 0;
}

function writeString(buffer, value, encoding)
{
    const len = Buffer.byteLength(value);
    writeVarUInt(buffer, len);
    buffer.write(value, helper.offset, len, encoding);
    helper.offset += len;
}

const helper = {
    offset: 0,
    getDataTypeByteLength: BufferPlus._getDataTypeByteLength,
    writeVarUInt: writeVarUInt,
    writeString: writeString,

    byteLengthString: function(value, encoding)
    {
        const len = Buffer.byteLength(value);
        return VarInt.byteLengthUInt(len) + len;
    },

    byteLengthBuffer: function(value)
    {
        const len = value.length;
        return VarInt.byteLengthUInt(len) + len;
    },

    byteLengthVarInt: function(value)
    {
        return VarInt.byteLengthInt(value);
    },

    byteLengthVarUInt: function(value)
    {
        return VarInt.byteLengthUInt(value);
    },

};


const READ_BUILTIN_TYPES = {
    'boolean': 'buffer.readUInt8Direct();',
    'int8': 'buffer.readInt8Direct();',
    'int16be': 'buffer.readInt16BEDirect();',
    'int16le': 'buffer.readInt16LEDirect();',
    'int32be': 'buffer.readInt32BEDirect();',
    'int32le': 'buffer.readInt32LEDirect();',
    'int64be': 'buffer.readInt64BEDirect();',
    'int64le': 'buffer.readInt64LEDirect();',

    'uint8': 'buffer.readUInt8Direct();',
    'uint16be': 'buffer.readUInt16BEDirect();',
    'uint16le': 'buffer.readUInt16LEDirect();',
    'uint32be': 'buffer.readUInt32BEDirect();',
    'uint32le': 'buffer.reaBufferSchemadUInt32LEDirect();',
    'uint64be': 'buffer.readUInt64BEDirect();',
    'uint64le': 'buffer.readUInt64LEDirect();',

    'floatbe': 'buffer.readFloatBEDirect();',
    'floatle': 'buffer.readFloatLEDirect();',

    'doublebe': 'buffer.readDoubleBEDirect();',
    'doublele': 'buffer.readDoubleLEDirect();',

    'varint': 'buffer.readVarIntDirect();',
    'varuint': 'buffer.readVarUIntDirect();',

    'string': 'buffer.readPackedStringDirect(strEnc);',
    'buffer': 'buffer.readPackedBufferDirect();',
};

function _genWriteStr(funcName, valueStr)
{
    return `buffer.write${funcName}Direct(${valueStr});`;
}

function getBuiltinWriteString(dataType, valueStr)
{
    switch (dataType)
    {
        case 'boolean': return _genWriteStr('UInt8', valueStr + ' ? 1 : 0');
        case 'int8': return _genWriteStr('Int8', valueStr);
        case 'int16be': return _genWriteStr('Int16BE', valueStr);
        case 'int16le': return _genWriteStr('Int16LE', valueStr);
        case 'int32be': return _genWriteStr('Int32BE', valueStr);
        case 'int32le': return _genWriteStr('Int32LE', valueStr);
        case 'int64be': return _genWriteStr('Int64BE', valueStr);
        case 'int64le': return _genWriteStr('Int64LE', valueStr);

        case 'uint8': return _genWriteStr('UInt8', valueStr);
        case 'uint16be': return _genWriteStr('UInt16BE', valueStr);
        case 'uint16le': return _genWriteStr('UInt16LE', valueStr);
        // case 'uint32be': return _genWriteStr('UInt32BE', valueStr);
        // case 'uint32le': return _genWriteStr('UInt32LE', valueStr);
        case 'uint32be': return `helper.offset = buffer.writeUInt32BE(${valueStr}, helper.offset);`;
        case 'uint32le': return `helper.offset = buffer.writeUInt32LE(${valueStr}, helper.offset);`;

        case 'uint64be': return _genWriteStr('UInt64BE', valueStr);
        case 'uint64le': return _genWriteStr('UInt64LE', valueStr);

        case 'floatbe': return _genWriteStr('FloatBE', valueStr);
        case 'floatle': return _genWriteStr('FloatLE', valueStr);
        case 'doublebe': return _genWriteStr('DoubleBE', valueStr);
        case 'doublele': return _genWriteStr('DoubleLE', valueStr);

        // case 'varint': return _genWriteStr('VarInt', valueStr);
        // case 'varuint': return _genWriteStr('VarUInt', valueStr);

        case 'varuint': return `helper.writeVarUInt(buffer, ${valueStr});`;

        case 'string': return `helper.writeString(buffer, ${valueStr}, strEnc);`;
        //case 'string': return `buffer.writePackedStringDirect(${valueStr}, strEnc);`;
        case 'buffer': return `buffer.writePackedBufferDirect(${valueStr});`;
    }
    return undefined;
}

function getBuiltinReadString(dataType, valueStr)
{
    return valueStr + ' = ' + READ_BUILTIN_TYPES[dataType];
}

function getByteLengthString(dataType, valueStr)
{
    const funcMap = BufferPlus._getTypeFuncMap(dataType);
    if (!funcMap || !funcMap.size)
        return '';
    if (typeof funcMap.size === 'number')
        return `byteCount += ${funcMap.size};`;

    switch (dataType.toLowerCase())
    {
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

function getDataTypeFunctionString(type, key, prefix)
{
    const dataType = type.trim();
    const typeLowerCase = dataType.toLowerCase();
    const readObjStr = (prefix ? 'data.' : '') + key.trim();
    const writeObjStr = (prefix ? 'json.' : '') + key.trim();

    // case insensitive
    if (READ_BUILTIN_TYPES.hasOwnProperty(typeLowerCase))
    {
        return {
            read: getBuiltinReadString(typeLowerCase, readObjStr),
            write: getBuiltinWriteString(typeLowerCase, writeObjStr),
            size: getByteLengthString(dataType, writeObjStr),
        };
    }
    // case sensitive
    else if (BufferPlus.hasCustomType(dataType))
    {
        return {
            read: readObjStr + ' = buffer.read' + dataType + '();',
            write: 'buffer.write' + dataType + '(' + writeObjStr + ')',
            size: getByteLengthString(dataType, writeObjStr),
        };
    }
    else
    {
        throw new TypeError('Invalid data type:' + dataType);
    }
}

module.exports = BufferSchema;
