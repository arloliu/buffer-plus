# Buffer Plus
> Enhanced high performance Node.js style Buffer with auto re-allocation, custom. types and static schematic support.
> 
> It's really fast that you should try.

# Introduction
Node.js native Buffer provides a easy way to manipulate binary data, which is useful for communicating between different languagesm, or tranfering data over network.

But it's annoying to calculate offset and buffer size when the binary data structure becomes complex. And it also annoying when we want to insert some bytes or needs to forward/rewind position.

This library aims to solve these problems with light weight overhead. Let programmer to define a flexiable custom. data types, or even define static schematic to present complex. data structure.

# Key Features
* Similiar API styles to native node.js Buffer API.
* Keeps track of read and write positions automatically.
* Automatic buffer resizing to make sure read/write operations safely.
* Support many extra methods to deal with variant integer, 64-bit integers, and string.
* Support customized data type definition.
* Support schematic definition with static data/field ordering.
* High performance, the static schematic decode/encode speed are the same as well programmed native Buffer API.

# Installation
Via NPM
```shell
    npm install buffer-plus
```
Via Yarn
```shell
    yarn add buffer-plus
```

# The Order of Binary Fields is Matter
When we want to exchange data which encoded or serialized in binary format between different programming languages or devices, there are several common ways like JSON, messagepack, protocol buffers...etc.

These encode/decode methods are great, but also with significant byte size and parsing time overhead...etc. And some methods like JSON has a problem: The order of object properties in the structure is not guaranteed due to the nature of these methods need to handle dynamic data structure.

It means the decode side needs to know the whole data size first, store whole data into buffer, then parse data. But in the case we defined the fixed data structure and want to one-phase data handling, the order of fields is matter.

We can read field bytes by bytes in one-phase only the order of fields are fixed, and the length of fields are well defined in data structure.

When we need to exchange data over high latency network, the data size is the key part of performance bottleneck than the decode/encode speed. And the most size-efficiency way to exchange data is with fixed, static data schematic.

# BufferPlus API Reference
Refer the delicate [BufferPlus API Reference](https://github.com/arloliu/buffer-plus/wiki/API.md)

# Examples
## Simple Schematic Example
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

// move to buffer begining
bp.moveTo(0);

// read account from buffer
const decodedAccount = bp.readSchema('Account');

// compare decoded and original account
assert.deepStrictEqual(account, decodedAccount);

```

## Simple Customized Type Example
```Javascript

const BufferPlus = require('buffer-plus');
const crypto = require('crypto');
const assert = require('assert');

function getMd5Hash(value) {
    return crypto.createHash('md5').update(value).digest('hex');
}
const bp = BufferPlus.alloc(1024);

BufferPlus.addCustomType('HashString',
        // writeHashString method
        (buffer) => {
            const hashLen = buffer.readUInt32LE();
            const valueLen = buffer.readUInt32LE();
            const hash = buffer.readString(hashLen);
            const value = buffer.readString(valueLen);
            return {value: value, hash: hash};
        },
        // readHashString method
        (buffer, value) => {
            const hash = getMd5Hash(value);
            buffer.writeUInt32LE(hash.length);
            buffer.writeUInt32LE(value.length);
            buffer.writeString(hash);
            buffer.writeString(value);
        },
        // byteLengthHashString method
        (buffer, value) => {
            const hash = getMd5Hash(value);
            return 8 + BufferPlus.byteLength(value) + BufferPlus.byteLength(hash);
        }
);

const str = 'test hash string';
bp.writeHashString(str);
bp.moveTo(0);

const hashStr = bp.readHashString();
assert.strictEqual(str, hashStr.value);
assert.strictEqual(getMd5Hash(hashStr.value), hashStr.hash);
```
