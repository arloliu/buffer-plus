Enhanced high performance Node.js style Buffer with auto re-allocation, custom. types and static schematic support.

It's really fast that you should try.

> Introduce golang version of schema-oriented JSON serialization library [JSONPack](https://github.com/arloliu/jsonpack). It can work with this library for encoding/decoding JSON document with schema definition.
# Introduction
Node.js native Buffer provides a easy way to manipulate binary data, which is useful for communication between different languages or for data exchange over network.

But it's annoying to calculate offset and buffer size when the binary data structure becomes complex, and it also annoying if we want to insert some bytes or needs to forward/rewind the operation position in buffer.

This library aims to solve these problems by implementing a light weight wrapper on top of node.js buffer. It also lets programmer to define flexible custom. data types, or defines schema definitions to describe complex. data structure then use pre-defined schema definitions to encode data into compact. encoding format.

# Key Features
* Similar API style to native node.js Buffer API.
* Keeps track of read and write positions automatically.
* Automatic buffer resizing to make sure read/write operations safely.
* Supports variant of methods to deal with variant integer, 64-bit integers, and string.
* Supports customized data type definition.
* Supports schema definition to describe data, the format of schema definition is similar to [JSON Schema](https://json-schema.org/).
* High performance, the decode/encode speed of schema is the same as well programmed code that using native Buffer API.

# Installation
Via NPM
```shell
    npm install buffer-plus
```
# The Order of Binary Fields is Matter
When we want to exchange data which encoded or serialized to binary format between different programming languages or devices, there are several common encoding formats like JSON, messagepack, protocol buffers...etc.

These encode/decode encoding format are great, but also with significant byte size and parsing time overhead...etc. 

For some encoding format like JSON has a problem:

*The order of object properties in the structure/object is not guaranteed due to the nature of dynamic data structure.*

It means the decode side needs to know the whole data size first, store whole data into buffer, then parse it, in other case if we define a fixed data structure and want to handle data in one-phase, we need to specify the order of fields.

We can only read field by bytes to bytes in one-phase if the order of fields are fixed and the length of fields are well defined in data structure.

When we need to exchange data over high latency network, the data size is the key part of performance bottleneck than the decode/encode speed. And the most size-efficiency way to exchange data is with fixed, static schema definition for data.

# BufferPlus API Reference
Refer [BufferPlus API Reference](https://github.com/arloliu/buffer-plus/wiki)

# Examples
## Schema Definition Example
```Javascript
const BufferPlus = require('buffer-plus');
const assert = require('assert');

// account data
const account = {
    name: 'user1',
    age: 18,
    languages: ['en-US', 'en-UK'],
    serial: 0x123456781234567,
};

// account schema definition
const AccountSchema = {
    type: 'object',
    properties: {
        name: {type: 'string'},
        age: {type: 'uint8'},
        languages: {
            type: 'array',
            items: {type: 'string'},
        },
        serial: {type: 'uint64le'},
    },
    order: ['name', 'age', 'languages', 'serial'],
};

// create a BufferPlus instance
const bp = BufferPlus.create();

// create Account schema
BufferPlus.createSchema('Account', AccountSchema);

// write account data with Account schema
bp.writeSchema('Account', account);

// move to buffer beginning
bp.moveTo(0);

// read account from buffer
const decodedAccount = bp.readSchema('Account');

// compare decoded and original account
assert.deepStrictEqual(account, decodedAccount);

```

## Customized Type Example
```Javascript

const BufferPlus = require('buffer-plus');
const crypto = require('crypto');
const assert = require('assert');

function getMd5Hash(value) {
    return crypto.createHash('md5').update(value).digest('hex');
}
const bp = BufferPlus.alloc(1024);

BufferPlus.addCustomType('HashString',
        // readHashString method
        (buffer) => {
            // read byte length of MD5 checksum from buffer
            const hashLen = buffer.readUInt32LE();
            // read byte length of value from buffer
            const valueLen = buffer.readUInt32LE();
            // read MD5 checksum  from buffer
            const hash = buffer.readString(hashLen);
            // read value from buffer
            const value = buffer.readString(valueLen);
            // return a object contains MD5 checksum and value
            return {value: value, hash: hash};
        },
        // writeHashString method
        (buffer, value) => {
            // calc. value's MD5 checksum 
            const hash = getMd5Hash(value);
            // write byte length of MD5 checksum to buffer
            buffer.writeUInt32LE(hash.length);
            // write byte length of value to buffer
            buffer.writeUInt32LE(value.length);
            // write MD5 checksum to buffer
            buffer.writeString(hash);
            // write value to buffer
            buffer.writeString(value);
        },
        // byteLengthHashString method
        (buffer, value) => {
            const hash = getMd5Hash(value);
            return 8 + BufferPlus.byteLength(value) + BufferPlus.byteLength(hash);
        }
);

const str = 'test hash string';
// write string into buffer with pre-defined 'HashString' custom. type.
// it gets string's MD5 checksum and write MD5 checksum
// and string into buffer
bp.writeHashString(str);

// seek to beginning
bp.moveTo(0);

// read buffer with with pre-defined 'HashString' custom. type.
// it reads MD5 checksum and string from buffer and
// returns a object contains 'hash' and 'value' properties.
const hashObj = bp.readhashObjing();

assert.strictEqual(str, hashObj.value);
assert.strictEqual(getMd5Hash(hashObj.value), hashObj.hash);
```
