'use strict';

function encodeUInt(value, output) {
  var val = value;
  var count = 0;

  while (val >= 2147483648) {
    output[count++] = val & 0xFF | 0x80;
    val /= 128;
  }

  while (val > 127) {
    output[count++] = val & 0xFF | 0x80;
    val >>>= 7;
  }

  output[count++] = val | 0;
  return count;
}

exports.encodeUInt = encodeUInt;

exports.encodeInt = function (value, output) {
  var val = value >= 0 ? value * 2 : value * -2 - 1;
  return encodeUInt(val, output);
};

function decodeUInt(buf, offset, endBoundary) {
  var val = 0;
  var shift = 0;
  var byte;
  var count = offset;

  do {
    if (count >= endBoundary) {
      throw new RangeError('Decode varint fail');
    }

    byte = buf[count++];
    val += shift < 28 ? (byte & 0x7F) << shift : (byte & 0x7F) * Math.pow(2, shift);
    shift += 7;
  } while (byte & 0x80);

  return [val, count - offset];
}

exports.decodeUInt = decodeUInt;

exports.decodeInt = function (buf, offset, endBoundary) {
  var result = decodeUInt(buf, offset, endBoundary);
  var val = result[0] & 1 ? (result[0] + 1) / -2 : result[0] / 2;
  return [val, result[1]];
};

function byteLengthUInt(value) {
  return value < 128 ? 1 : value < 16384 ? 2 : value < 2097152 ? 3 : value < 268435456 ? 4 : value < 34359738368 ? 5 : value < 4398046511104 ? 6 : value < 562949953421312 ? 7 : value < 72057594037927936 ? 8 : value < 9223372036854775808 ? 9 : 10;
}

exports.byteLengthUInt = byteLengthUInt;

exports.byteLengthInt = function (value) {
  return byteLengthUInt(value >= 0 ? value * 2 : value * -2 - 1);
};