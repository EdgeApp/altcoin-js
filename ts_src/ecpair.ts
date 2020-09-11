import { Network } from './networks';
import * as NETWORKS from './networks';
import * as types from './types';
const ecc = require('tiny-secp256k1');
const randomBytes = require('randombytes');
const typeforce = require('typeforce');
const wif = require('wif');
const bs58check = require('bs58check');

const isOptions = typeforce.maybe(
  typeforce.compile({
    compressed: types.maybe(types.Boolean),
    network: types.maybe(types.Network),
  }),
);

interface ECPairOptions {
  compressed?: boolean;
  network?: Network;
  rng?(arg0: number): Buffer;
}

export interface Signer {
  publicKey: Buffer;
  network?: any;
  sign(hash: Buffer, lowR?: boolean): Buffer;
  getPublicKey?(): Buffer;
}

export interface SignerAsync {
  publicKey: Buffer;
  network?: any;
  sign(hash: Buffer, lowR?: boolean): Promise<Buffer>;
  getPublicKey?(): Buffer;
}

export interface ECPairInterface extends Signer {
  compressed: boolean;
  network: Network;
  lowR: boolean;
  privateKey?: Buffer;
  toWIF(): string;
  verify(hash: Buffer, signature: Buffer): boolean;
}

class ECPair implements ECPairInterface {
  compressed: boolean;
  network: Network;
  lowR: boolean;

  constructor(
    private __D?: Buffer,
    private __Q?: Buffer,
    options?: ECPairOptions,
  ) {
    this.lowR = false;
    if (options === undefined) options = {};
    this.compressed =
      options.compressed === undefined ? true : options.compressed;
    this.network = options.network || NETWORKS.bitcoin;

    if (__Q !== undefined) this.__Q = ecc.pointCompress(__Q, this.compressed);
  }

  get privateKey(): Buffer | undefined {
    return this.__D;
  }

  get publicKey(): Buffer {
    if (!this.__Q)
      this.__Q = ecc.pointFromScalar(this.__D, this.compressed) as Buffer;
    return this.__Q;
  }

  toWIF(
    wifEncodeFunc?: (prefix: any, key: any, compressed: any) => string,
  ): string {
    if (!this.__D) throw new Error('Missing private key');
    if (typeof wifEncodeFunc !== 'undefined') {
      return wifEncodeFunc(this.network.wif, this.__D, this.compressed);
    }
    return wif.encode(this.network.wif, this.__D, this.compressed);
  }

  sign(hash: Buffer, lowR?: boolean): Buffer {
    if (!this.__D) throw new Error('Missing private key');
    if (lowR === undefined) lowR = this.lowR;
    if (lowR === false) {
      return ecc.sign(hash, this.__D);
    } else {
      let sig = ecc.sign(hash, this.__D);
      const extraData = Buffer.alloc(32, 0);
      let counter = 0;
      // if first try is lowR, skip the loop
      // for second try and on, add extra entropy counting up
      while (sig[0] > 0x7f) {
        counter++;
        extraData.writeUIntLE(counter, 0, 6);
        sig = ecc.signWithEntropy(hash, this.__D, extraData);
      }
      return sig;
    }
  }

  verify(hash: Buffer, signature: Buffer): boolean {
    return ecc.verify(hash, this.publicKey, signature);
  }
}

function fromPrivateKey(buffer: Buffer, options?: ECPairOptions): ECPair {
  typeforce(types.Buffer256bit, buffer);
  if (!ecc.isPrivate(buffer))
    throw new TypeError('Private key not in range [1, n)');
  typeforce(isOptions, options);

  return new ECPair(buffer, undefined, options);
}

function fromPublicKey(buffer: Buffer, options?: ECPairOptions): ECPair {
  typeforce(ecc.isPoint, buffer);
  typeforce(isOptions, options);
  return new ECPair(undefined, buffer, options);
}

function wifDecode(
  wifString: string,
  version: number,
  bs58DecodeFunc?: (wifString: string) => any,
): any {
  if (version < 256) {
    let bsBuffer: any;
    if (typeof bs58DecodeFunc !== 'undefined') {
      bsBuffer = bs58DecodeFunc(wifString);
    } else {
      bsBuffer = bs58check.decode(wifString);
    }
    if (bsBuffer.length === 33) {
      return {
        version: bsBuffer[0],
        privateKey: bsBuffer.slice(1, 33),
        compressed: false,
      };
    }
    // invalid length
    if (bsBuffer.length !== 34) throw new Error('Invalid WIF length');
    // invalid compression flag
    if (bsBuffer[33] !== 0x01) throw new Error('Invalid compression flag');
    return {
      version: bsBuffer[0],
      privateKey: bsBuffer.slice(1, 33),
      compressed: true,
    };
  }

  // long version bytes use blake hash for bs58 check encoding
  let buffer: Buffer;
  if (typeof bs58DecodeFunc !== 'undefined') {
    buffer = bs58DecodeFunc(wifString);
  } else {
    buffer = bs58check.decode(wifString);
  }
  // extra case for two byte WIF versions
  if (buffer.length === 34) {
    return {
      version: buffer.readUInt16LE(1),
      privateKey: buffer.slice(2, 34),
      compressed: false,
    };
  }
  // invalid length
  if (buffer.length !== 35) throw new Error('Invalid WIF length');
  // invalid compression flag
  if (buffer[34] !== 0x01) throw new Error('Invalid compression flag');
  return {
    version: buffer.readUInt16LE(1),
    privateKey: buffer.slice(2, 34),
    compressed: true,
  };
}

function fromWIF(
  wifString: string,
  network?: Network | Network[],
  bs58DecodeFunc?: (wif: string) => any,
): ECPair {
  let decoded: any;
  let version: any;

  if (!types.Array(network) && typeof network !== 'undefined') {
    decoded = wifDecode(wifString, (network as Network).wif, bs58DecodeFunc);
    version = decoded.version;
  } else {
    decoded = wif.decode(wifString);
    version = decoded.version;
  }

  // list of networks?
  if (types.Array(network)) {
    network = (network as Network[])
      .filter((x: Network) => {
        return version === x.wif;
      })
      .pop() as Network;

    if (!network) throw new Error('Unknown network version');

    // otherwise, assume a network object (or default to bitcoin)
  } else {
    network = network || NETWORKS.bitcoin;

    if (version !== (network as Network).wif)
      throw new Error('Invalid network version');
  }

  return fromPrivateKey(decoded.privateKey, {
    compressed: decoded.compressed,
    network: network as Network,
  });
}

function makeRandom(options?: ECPairOptions): ECPair {
  typeforce(isOptions, options);
  if (options === undefined) options = {};
  const rng = options.rng || randomBytes;

  let d;
  do {
    d = rng(32);
    typeforce(types.Buffer256bit, d);
  } while (!ecc.isPrivate(d));

  return fromPrivateKey(d, options);
}

export { makeRandom, fromPrivateKey, fromPublicKey, fromWIF };
