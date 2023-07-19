'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const NETWORKS = require('./networks');
const types = require('./types');
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
class ECPair {
  constructor(__D, __Q, options) {
    this.__D = __D;
    this.__Q = __Q;
    this.lowR = false;
    if (options === undefined) options = {};
    this.compressed =
      options.compressed === undefined ? true : options.compressed;
    this.network = options.network || NETWORKS.bitcoin;
    if (__Q !== undefined) this.__Q = ecc.pointCompress(__Q, this.compressed);
  }
  get privateKey() {
    return this.__D;
  }
  get publicKey() {
    if (!this.__Q) this.__Q = ecc.pointFromScalar(this.__D, this.compressed);
    return this.__Q;
  }
  toWIF() {
    if (!this.__D) throw new Error('Missing private key');
    return wif.encode(this.network.wif, this.__D, this.compressed);
  }
  sign(hash, lowR) {
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
  verify(hash, signature) {
    return ecc.verify(hash, this.publicKey, signature);
  }
}
function fromPrivateKey(buffer, options) {
  typeforce(types.Buffer256bit, buffer);
  if (!ecc.isPrivate(buffer))
    throw new TypeError('Private key not in range [1, n)');
  typeforce(isOptions, options);
  return new ECPair(buffer, undefined, options);
}
exports.fromPrivateKey = fromPrivateKey;
function fromPublicKey(buffer, options) {
  typeforce(ecc.isPoint, buffer);
  typeforce(isOptions, options);
  return new ECPair(undefined, buffer, options);
}
exports.fromPublicKey = fromPublicKey;
function wifDecode(wifString, version, bs58DecodeFunc) {
  if (version < 256) {
    const buffer = bs58check.decode(wifString);
    if (buffer.length === 33) {
      return {
        version: buffer[0],
        privateKey: buffer.slice(1, 33),
        compressed: false,
      };
    }
    // invalid length
    if (buffer.length !== 34) throw new Error('Invalid WIF length');
    // invalid compression flag
    if (buffer[33] !== 0x01) throw new Error('Invalid compression flag');
    return {
      version: buffer[0],
      privateKey: buffer.slice(1, 33),
      compressed: true,
    };
  }
  // long version bytes use blake hash for bs58 check encoding
  let buffer;
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
function fromWIF(wifString, network) {
  let decoded;
  let version;
  if (!types.Array(network) && typeof network !== 'undefined') {
    decoded = wifDecode(wifString, network.wif);
    version = decoded.version;
  } else {
    decoded = wif.decode(wifString);
    version = decoded.version;
  }
  // list of networks?
  if (types.Array(network)) {
    network = network
      .filter(x => {
        return version === x.wif;
      })
      .pop();
    if (!network) throw new Error('Unknown network version');
    // otherwise, assume a network object (or default to bitcoin)
  } else {
    network = network || NETWORKS.bitcoin;
    if (version !== network.wif) throw new Error('Invalid network version');
  }
  return fromPrivateKey(decoded.privateKey, {
    compressed: decoded.compressed,
    network: network,
  });
}
exports.fromWIF = fromWIF;
function makeRandom(options) {
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
exports.makeRandom = makeRandom;
