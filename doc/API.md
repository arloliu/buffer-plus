# Buffer Plus API Reference
BufferPlus has very similar API to node.js `Buffer`, all the common methods likes alloc(), allocUnsafe(), from(), read/write&lt;Number|String|>()...etc are supported. So the programer is quite easy to master with this library without steep learning curve.

## BufferPlus Class Methods

### BufferPlus.create([size])
* size: &lt;Integer> The desired size of the new `BufferPlus` instance.
* Returns: &lt;BufferPlus>
Create a new non-zero-filled `BufferPlus` object. with `size`, or create a 64 bytes `BufferPlus` object is `size` is not specified.

> It is a alias method of `BufferPlus.allocUnsafe(size)`

### BufferPlus.create(buffer)
* buffer: &lt;Buffer> or &lt;BufferPlus> instance
Create a reference of `buffer`. 
The new `BufferPlus` instance shares the same allocated memory of original `Buffer` or `BufferPlus` instance.

> The behavior is the same as `BufferPlus.from(buffer)`

### BufferPlus.alloc(size[, fill[, encoding]])
Allocates a new `BufferPlus` object of size bytes. If fill is undefined, the Buffer will be zero-filled.

> Same behavior as node.js [Buffer.alloc](https://nodejs.org/api/buffer.html#buffer_class_method_buffer_alloc_size_fill_encoding) except it returns a `BufferPlus` object.

### BufferPlus.allocUnsafe(size)
Allocates a new non-zero-filled `BufferPlus` object of size bytes.

> Same behavior as node.js [Buffer.allocUnsafe](https://nodejs.org/api/buffer.html#buffer_class_method_buffer_allocunsafe_size) except it returns a `BufferPlus` object.

### BufferPlus.byteLength(string[, encoding])
Returns the actual byte length of a string.

> Same behavior as node.js [Buffer.byteLength](https://nodejs.org/api/buffer.html#buffer_class_method_buffer_bytelength_string_encoding)

### BufferPlus.compare(buf1, buf2)
* buf1: `Buffer` or `BufferPlus` instances
* buf2: `Buffer` or `BufferPlus` instance
* Returns: &lt;integer>

Compares buf1 to buf2 typically for the purpose of sorting arrays of `Buffer` or `BufferPlus` instances. 
> Same behavior as node.js [Buffer.compare]() except it accepts both `Buffer` and `BufferPlus` instances.

### BufferPlus.concat(list[, totalLength])
* list: &lt;Array> of `Buffer` or `BufferPlus` instances
* totalLength: Total length of list when concatenated
* Returns: new &lt;BufferPlus> instance

Returns a new Buffer which is the result of concatenating all the Buffer instances in the list together.

> Same behavior as node.js [Buffer.concat](https://nodejs.org/api/buffer.html#buffer_class_method_buffer_concat_list_totallength) expect it accepts list of `Buffer` or `BufferPlus` instances.

### BufferPlus.from(...)
Create a new `BufferPlus` instance or create a view of `ArrayBuffer` or a refernce of `Buffer` or `BufferPlus`.

> Same behavior as node.js [Buffer.from](https://nodejs.org/api/buffer.html#buffer_class_method_buffer_from_buffer) when the argument types are `String`, `Array` and `ArrayBuffer`.

> But it create a reference when the argument types are `Buffer` or `BufferPlus` without copying the underlying memory, which means the new `BufferPlus` instance will share the same allocated memory of original `Buffer` or `BufferPlus` instance.

### BufferPlus.clone(...)
The API is same as `BufferPlus.from(...)`, but always create a new allocated memory and copy data from original, even the argument types are `Buffer`, `ArrayBuffer` or `BufferPlus`.

> `BufferPlus` Extenstion Method.

### BufferPlus.isBuffer(obj)
* obj: &lt;Object>
* Returns: &lt;boolean>
 
Returns `true` if `obj` is a `Buffer`, false otherwise.

> Same behavior as node.js [Buffer.isBuffer](https://nodejs.org/api/buffer.html#buffer_class_method_buffer_isbuffer_obj)

### BufferPlus.isBufferPlus(obj)

Returns `true` if `obj` is a `BufferPlus`, false otherwise.

> `BufferPlus` Extenstion Method.

### BufferPlus.isEncoding(encoding)

Returns `true` if encoding contains a supported character encoding, or `false` otherwise.

> Same behavior as node.js [Buffer.isEncoding](https://nodejs.org/api/buffer.html#buffer_class_method_buffer_isencoding_encoding)

---

## Common Properties
### buffer.length
The length of the data that is being tracked in the internal `Buffer`. 

The length will be **zero** when a new empty `BufferPlus` instance created from `create(size)`, `alloc(...)` or `allocUnsafe(...)`.

And the length will be the `length` of the input argument when it's created from `create(buffer)`, `from(...)`, or `clone(...)`.

Example:
```javascript
// buf1.length === 0, buf1.position === 0, buf1.size === 1024
const buf1 = BufferPlus.create(1024);

// buf2.length === 6, buf1.position === 0, buf1.size === 6
const buf2 = BufferPlus.from('string', 'ascii');

// buf3.length === 6, buf3.position === 0, buf3.size === 6
const buf3 = BufferPlus.clone(buf2);

// buf2.length === 128, buf1.position === 0, buf1.size === 128
const buf4 = BufferPlus.from(Buffer.alloc(128));
```

> > It's not the real byte size of the internal `Buffer`. If you want to get the real size of internal `Buffer`, please read `buffer.size` property.


### buffer.position
The current position that is read from or write to.

The `position` are be confused with `length` someteims because they have the same value in some cases.

The most significant difference between `position` and `length` is: 
* `position` is the offset we read or write data, like a cursor, NOT the byte length we already wrote.
* `length` presents the length of buffer that we already wrote data into it.

Example:
```javascript
const user = BufferPlus.create();
// user.length === 0, user.position === 0 after created

// write a user ID
user.writeUInt32LE(1000);
// user.length === 4, user.position === 4 after writeUInt32LE

const cloneUser = BufferPlus.clone(user);
// cloneUser.length === 4, cloneUser.position === 0 
```

### buffer.remaining
The remaining bytes in buffer, equals to `buffer.length - buffer.position`

### buffer.size
The byte length of the internal `Buffer`

## Position Manipulation
### buffer.moveTo(position)
* position: &lt;Integer> The position want to move to.

Move to the position, the `position` must be the value between 0 to buffer.length.

### skip(offset)
* offset: &lt;Integer> The bytes want to skip.

Skip `offset` bytes , equals to `buffer.moveTo(buffer.position + offset)`.

The target position must between 0 to buffer.length.

### rewind(offset)
* offset: &lt;Integer> The bytes want to skip.
Rewind back `offset` bytes, it is opposite to `buffer.skip(offset)`, equals to `buffer.moveTo(buffer.position - offset)`.

The target position must between 0 to buffer.length.


## Standard Numeric
The various of read/write number methods are simliar to native node.js `Buffer` APIs, but without the `offset` argument.

All read/write methods share the same API style.

```javascript
buffer.read<NumericType>()
buffer.write<NumericType>(value[, insertOffset])
```
Which `value` is the numeric value want to write, and the optional `insertOffset` argument is used to insert the `value` to the specific position.

The read methods return corresponding type of value.

The write methods return `<BufferPlus>` instance for chainable operations.

Note when using `insertOffset` argument to insert `value`, it does not override data at the given position. It will move the exist data from the `insertOffset` position to (`insertOffset` + `byteLength`), which `byteLength` is the byte size of numeric value, then write numeric value to the `insertOffset` position.

It means it will execute in-buffer copying operation when we want to insert data, and might affects performance if operating a large buffer.

**Supported Read Methods**
* readInt8()
* readInt16BE()
* readInt16LE()
* readInt32BE()
* readInt32LE()
* readInt64BE()
* readInt64LE()
* readUInt8()
* readUInt16BE()
* readUInt16LE()
* readUInt32BE()
* readUInt32LE()
* readUInt64BE()
* readUInt64LE()
* readFloatBE()
* readFloatLE()
* readDoubleBE()
* readDoubleLE()

**Supported Write Methods**
* writeInt8(value[, insertOffset])
* writeInt16BE(value[, insertOffset])
* writeInt16LE(value[, insertOffset])
* writeInt32BE(value[, insertOffset])
* writeInt32LE(value[, insertOffset])
* writeInt64BE(value[, insertOffset])
* writeInt64LE(value[, insertOffset])
* writeUInt8(value[, insertOffset])
* writeUInt16BE(value[, insertOffset])
* writeUInt16LE(value[, insertOffset])
* writeUInt32BE(value[, insertOffset])
* writeUInt32LE(value[, insertOffset])
* writeUInt64BE(value[, insertOffset])
* writeUInt64LE(value[, insertOffset])
* writeFloatBE(value[, insertOffset])
* writeFloatLE(value[, insertOffset])
* writeDoubleBE(value[, insertOffset])
* writeDoubleLE(value[, insertOffset])

> Javascript &lt;Number> object can only can only safely represent numbers between -(2^53 - 1) to 2^53 - 1, This library will convert &lt;Number> object to/from 64-bit signed/unsigned integers. But if the 64-bit interger store on the buffer is larger than the range of  &lt;Number> object, the result will not correct.
> 

## Variant Integer
Variant Integet(Varint) is a special integer encoding method which introduced in [Protocol Buffer](https://developers.google.com/protocol-buffers/)

It's useful to store length of dynamic data, which the length is variable.

Varints are a method of serializing integers using one or more bytes. Smaller numbers take a smaller number of bytes. 

Each byte in a varint, except the last byte, has the most significant bit (msb) set – this indicates that there are further bytes to come. The lower 7 bits of each byte are used to store the two's complement representation of the number in groups of 7 bits, least significant group first.

In general speaking, Varint use 7 bits of each byte to store number, each byte store 7 bit instead of 8-bit.

The bytes to value mapping of un-signed VARUINT will be:
* 1 byte: 0 to 127
* 2 bytes: 128 to 16,383
* 3 bytes: 16,384 to 2,097,151
* 4 bytes: 2,097,152 to 268,435,455
* ... etc.

The bytes to value mapping of signed VARUINT will be:
* 1 byte: -64 to 63
* 2 bytes: -8,192 to 8,191
* 3 bytes: -1,048,576 to 1,048,575
* 4 bytes: -134,217,728 to 134,217,727
* ... etc.
### buffer.readVarInt()
Read signed variant integer

### buffer.readVarUInt()
Read un-signed variant integer

### buffer.writeVarInt(value[, insertOffset])
Write signed variant integer

### buffer.writeVarUInt(value[, insertOffset])
Write un-signed variant integer


## String
Provides `readString`/`writeString` methods for raw string operations.

And provides convenient packed `readPackedString`/`writePackedString` methods which contains string length information itself.

Examples:
```javascript
/*** Packed string opertion example ***/
const assert = require('assert');

const buf = BufferPlus.create();
buf.setEncoding('utf8');

const str = 'this is string';
const len = BufferPlus.byteLengthPackedString(str);

// write string to buffer
buf.writePackedString(str);
// move to begining position
buf.moveTo(0);
// fetch the string we wrote
const result = buf.readPackedString();

// compare result & str
assert.strictEqual(str, result);

```

```javascript
/*** Raw string opertion example ***/
const assert = require('assert');

const buf = BufferPlus.create();
buf.setEncoding('utf8');

const str = 'this is string';
const len = BufferPlus.byteLength(str);
// write string to buffer
buf.writeString(str, len);
// move to begining position
buf.moveTo(0);
// fetch the string we wrote
const result = buf.readString(len);

// compare result & str
assert.strictEqual(str, result);
```

### buffer.encoding
&lt;String> The default string encoding of this buffer, defaults to `'utf8'`

### buffer.setEncoding(encoding)
* encoding: &lt;String> The encoding of string.

Set the default string encoding to `encoding`.


### buffer.readString([length][, encoding])
* length: &lt;Integer> Number of bytes to read. **Default**: buffer.length - buffer.position
* encoding: &lt;String> The encoding of string. **Default**: 'utf8'.
* Returns: &lt;String>

Read string according to the specified character encoding in `encoding`.

### buffer.writeString(str [, insertOffset][, encoding])
* str: &lt;String> String to write to `BufferPlus`.
* insertOffset: &lt;Integer> Insert the `str` to the specific position.
* encoding: &lt;String> The encoding of string. **Default**: `buffer.encoding`.
* Returns: Current &lt;BufferPlus> instance.

Write string to `BufferPlus`.

### buffer.readPackedString([encoding])
* encoding: &lt;String> The encoding of string. **Default**: `buffer.encoding`.
* Returns: &lt;String>

The convenient way to read string with packed format, which is &lt;Varint> + &lt;String>.

The &lt;Varint> presents the length of string, and the &lt;String> value presents the content of string.

### buffer.writePackedString(str [, insertOffset][, encoding])
* str: &lt;String> String to write to buffer.
* insertOffset: &lt;Integer> Insert the `str` to the specific position.
* encoding: &lt;String> The encoding of string. **Default**: `buffer.encoding`.
* Returns: Current &lt;BufferPlus> instance.

The convenient way to write string to `BufferPlus` with packed format.

The data structure of this method is: &lt;Varint> + &lt;String>.

The &lt;Varint> presents the length of `str`, and the &lt;String> value presents the content of `str`.

### BufferPlus.byteLengthPackedString(str[, encoding])
* str: &lt;String> String content to be calculated.
* encoding: &lt;String> The encoding of string. **Default**: `buffer.encoding`.
* Returns: &lt;Integer>

Calculate the byte length of `str` with packed string format.

## Buffer
Provides `readBuffer`/`writeBuffer` methods for raw buffer operations.

And provides convenient packed `readPackedBuffer`/`writePackedBuffer` methods which contains buffer length information itself.

Examples:
```javascript
/*** Packed buffer opertion example ***/
const assert = require('assert');

const buf = BufferPlus.create();

const buf1 = Buffer.from([0x74, 0xc3, 0xa9, 0x75, 0x76]);
const len = BufferPlus.byteLengthPackedBuffer(buf1);

// write string to buffer
buf.writePackedBuffer(buf1);
// move to begining position
buf.moveTo(0);
// fetch the string we wrote
const result = buf.writePackedBuffer();

// compare result & str
assert.strictEqual(buf1, result);

```

```javascript
/*** Raw buffer opertion example ***/
const assert = require('assert');

const buf = BufferPlus.create();

const buf1 = Buffer.from([0x74, 0xc3, 0xa9, 0x75, 0x76]);
const len = BufferPlus.byteLength(buf1);
// write string to buffer
buf.writeBuffer(buf1);
// move to begining position
buf.moveTo(0);
// fetch the string we wrote
const result = buf.readBuffer(len);

// compare result & str
assert.strictEqual(buf1, result);
```

### buffer.readBuffer([length])
* length: &lt;Integer> Number of bytes to read. **Default**: buffer.length - buffer.position
* Returns: &lt;Buffer>

Read & returns a node.js `<Buffer>` 

### buffer.writeBuffer(buf [, insertOffset])
* buf: &lt;Buffer> `buf` to write to `BufferPlus`.
* insertOffset: &lt;Integer> Insert the `buf` to the specific position.
* Returns: Current &lt;BufferPlus> instance.

Write `buf` to `BufferPlus`.

### buffer.readPackedBuffer()
The convenient way to read `<Buffer>` with packed format, which is &lt;Varint> + &lt;Buffer>.

The &lt;Varint> presents the length of `<Buffer>`, and the &lt;Buffer> value presents the content of `<Buffer>`.

### buffer.writePackedBuffer(buf [, insertOffset])
* buf: &lt;Buffer> `buf` to write to `BufferPlus`.
* insertOffset: &lt;Integer> Insert the `buf` to the specific position.
* Returns: Current &lt;BufferPlus> instance.

The convenient way to write `buf` to `BufferPlus` with packed format.

The data structure of this method is: &lt;Varint> + &lt;Buffer>.

The &lt;Varint> presents the length of `buf`, and the &lt;Buffer> value presents the content of `buf`.

### BufferPlus.byteLengthPackedBuffer(buf)
* buf: &lt;Buffer> Buffer content to be calculated.
* Returns: &lt;Integer>

Calculate the byte length of `buf` with packed buffer format.

## Array
Provides `readArray`/`writeArray` methods for array manipulation.

```Javascript
/*** Array Operation Example ***/
const assert = require('assert');

const items = ['str1', 'str2', 'str3'];

const bp = BufferPlus.create();

bp.writeArray(items, 'string');
bp.moveTo(0);
const result = bp.readArray('string');

assert.strictEqual(items, result);
```

### buffer.readArray(dataType)
* dataType: &lt;String> Data type want to read, possible values are built-in ta types, custom types or schema name.
* Returns: &lt;Array>

Returns array of items which wrote by `buffer.writeArray` method.

### buffer.writeArray(items, dataType[, insertOffset])
* items: &lt;Array> Items with type of `dataType` want to write
* dataType: &lt;String> Data type want to read, possible values are built-in ta types, custom types or schema name.
* insertOffset: &lt;Integer> Insert the `items` to the specific position.
* Returns: Current &lt;BufferPlus> instance

Write `items` with data type of `dataType` into `BufferPlus`.

---

## Custom. Type Methods
### BufferPlus.hasCustomType(type)

### BufferPlus.addCustomType(name, readFunc, writeFunc, sizeFunc)

---

## Static Schematic
### BufferPlus.hasSchema(name)

### BufferPlus.getSchema(name)

### BufferPlus.createSchema(name, schmea)

## BufferSchema Prototype Methods
### schema.addField(key, dataType)

### schema.addArrayField(key, dataType)

### schema.build()

### schema.byteLength(data)

### schema.decode(buffer)

### schema.encode(buffer, data)

### schema.setEncoding(encoding)
* encoding: &lt;String> The encoding of string.

Set schema default string encoding to `encoding`.