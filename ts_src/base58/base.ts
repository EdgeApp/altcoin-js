'use strict';

import { Buffer } from 'buffer';

const base58 = require('bs58');

interface Base58BaseReturn {
  encode: (payload: Buffer) => string;
  decode: (stringPayload: string) => Buffer;
  decodeUnsafe: (stringPayload: string) => Buffer | undefined;
}

export function base58Base(
  checksumFn: (buffer: Buffer) => Buffer,
): Base58BaseReturn {
  // Encode a buffer as a base58-check encoded string
  function encode(payload: Buffer): string {
    const checksum: Buffer = checksumFn(payload);

    return base58.encode(
      Buffer.concat([payload, checksum], payload.length + 4),
    );
  }

  function decodeRaw(buffer: Buffer): Buffer | undefined {
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
  function decodeUnsafe(stringPayload: string): Buffer | undefined {
    const buffer = base58.decodeUnsafe(stringPayload);
    if (typeof buffer === 'undefined') return;

    return decodeRaw(buffer);
  }

  function decode(stringPayload: string): Buffer {
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
