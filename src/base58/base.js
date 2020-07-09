'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const buffer_1 = require('buffer');
const base58 = require('bs58');
function base58Base(checksumFn) {
  // Encode a buffer as a base58-check encoded string
  function encode(payload) {
    const checksum = checksumFn(payload);
    return base58.encode(
      buffer_1.Buffer.concat([payload, checksum], payload.length + 4),
    );
  }
  function decodeRaw(buffer) {
    const payload = buffer.slice(0, -4);
    const checksum = buffer.slice(-4);
    const newChecksum = checksumFn(payload);
    console.log(
      buffer.toString('hex'),
      buffer,
      'payload: ',
      payload,
      'as included: ',
      checksum,
      'new checksum: ',
      newChecksum,
    );
    if (
      (checksum[0] ^ newChecksum[0]) |
      (checksum[1] ^ newChecksum[1]) |
      (checksum[2] ^ newChecksum[2]) |
      (checksum[3] ^ newChecksum[3])
    )
      return;
    return payload;
  }
  // Decode a base58-check encoded string to a buffer, no result if checksum is wrong
  function decodeUnsafe(stringPayload) {
    const buffer = base58.decodeUnsafe(stringPayload);
    if (typeof buffer === 'undefined') return;
    return decodeRaw(buffer);
  }
  function decode(stringPayload) {
    const buffer = base58.decode(stringPayload);
    const payload = decodeRaw(buffer);
    if (!payload) throw new Error('Invalid checksum');
    return payload;
  }
  return {
    encode,
    decode,
    decodeUnsafe,
  };
}
exports.base58Base = base58Base;
