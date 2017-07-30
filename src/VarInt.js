'use strict';
const MSB_BYTES = ~(0x7F);

// Encode
exports.encodeUInt = function(value, output)
{
    let val = value;
    let count = 0;

    while (val >= 2147483648) // val >= 2^31
    {
        output[count++] = (val & 0xFF) | 0x80;
        val /= 128;
    }

    while (val > 127)
    {
        output[count++] = (val & 0xFF) | 0x80;
        val >>>= 7;
    }
    output[count++] = val | 0;

    return count;
};

exports.encodeInt = function(value, output)
{
    const val = value >= 0 ? value * 2 : (value * -2) - 1;
    return exports.encodeUInt(val, output);
};

// Decode
// return [value, byte length]
exports.decodeUInt = function(buf, offset, endBoundary)
{
    let val = 0;
    let shift = 0;
    let byte;
    let count = offset;
    do
    {
        if (count >= endBoundary)
            throw new RangeError('Decode varint fail');

        byte = buf[count++];
        val += (shift < 28)
            ? (byte & 0x7F) << shift
            : (byte & 0x7F) * Math.pow(2, shift);
        shift += 7;
    }
    while (byte & 0x80);

    return [val, count - offset];
};

exports.decodeInt = function(buf, offset, endBoundary)
{
    const result = exports.decodeUInt(buf, offset, endBoundary);
    const val = (result[0] & 1) ? (result[0] + 1) / -2 : result[0] / 2;
    return [val, result[1]];
};




const N1 = Math.pow(2, 7);
const N2 = Math.pow(2, 14);
const N3 = Math.pow(2, 21);
const N4 = Math.pow(2, 28);
const N5 = Math.pow(2, 35);
const N6 = Math.pow(2, 42);
const N7 = Math.pow(2, 49);
const N8 = Math.pow(2, 56);
const N9 = Math.pow(2, 63);

exports.byteLengthUInt = function(value)
{
    return (
        value < N1   ? 1
        : value < N2 ? 2
        : value < N3 ? 3
        : value < N4 ? 4
        : value < N5 ? 5
        : value < N6 ? 6
        : value < N7 ? 7
        : value < N8 ? 8
        : value < N9 ? 9
        : 10
    );
};

exports.byteLengthInt = function(value)
{
    return UIntByteLength((value & 1) ? (value + 1) / -2 : value / 2);
};
