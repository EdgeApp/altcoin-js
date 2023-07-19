import * as cashaddr from './cashaddr';
import { Network } from './networks';
import * as networks from './networks';
import * as payments from './payments';
import * as bscript from './script';
import * as types from './types';

const bech32 = require('bech32');
const bs58check = require('bs58check');
const typeforce = require('typeforce');

export interface Base58CheckResult {
  hash: Buffer;
  version: number;
}

export interface Bech32Result {
  version: number;
  prefix: string;
  data: Buffer;
}

export function fromBase58Check(
  address: string,
  bs58DecodeFunc?: (address: string) => any,
): Base58CheckResult {
  const isBCH = cashaddr.VALID_PREFIXES.indexOf(address.split(':')[0]) > -1;
  if (isBCH) {
    const result = cashaddr.decode(address);
    let network: Network;
    switch (result.prefix) {
      case 'bitcoincash':
        network = networks.bitcoin;
        break;
      case 'bchtest':
        network = networks.testnet;
        break;
      case 'bchreg':
        network = networks.regtest;
        break;
    }
    let version: number;
    switch (result.type) {
      case 'P2PKH':
        version = network!.pubKeyHash;
        break;
      case 'P2SH':
        version = network!.scriptHash;
        break;
    }

    if (result.hash.length < 20) throw new TypeError(address + ' is too short');
    if (result.hash.length > 20) throw new TypeError(address + ' is too long');

    return {
      version: version!,
      hash: Buffer.from(result.hash),
    };
  } else {
    let payload: any;
    if (typeof bs58DecodeFunc !== 'undefined') {
      payload = bs58DecodeFunc(address);
    } else {
      payload = bs58check.decode(address);
    }

    // TODO: 4.0.0, move to "toOutputScript"
    if (payload.length < 21) throw new TypeError(address + ' is too short');
    if (payload.length > 21) throw new TypeError(address + ' is too long');

    const version = payload.readUInt8(0);
    const hash = payload.slice(1);

    return { version, hash };
  }
}

export function fromBech32(address: string): Bech32Result {
  const result = bech32.decode(address);
  const data = bech32.fromWords(result.words.slice(1));

  return {
    version: result.words[0],
    prefix: result.prefix,
    data: Buffer.from(data),
  };
}

export function toBase58Check(
  hash: Buffer,
  version: number,
  bs58EncodeFunc?: (payload: Buffer) => string,
): string {
  typeforce(types.tuple(types.Hash160bit, types.UInt8), arguments);

  const payload = Buffer.allocUnsafe(21);
  payload.writeUInt8(version, 0);
  hash.copy(payload, 1);
  if (typeof bs58EncodeFunc !== 'undefined') {
    return bs58EncodeFunc(payload);
  }
  return bs58check.encode(payload);
}

export function toBech32(
  data: Buffer,
  version: number,
  prefix: string,
): string {
  const words = bech32.toWords(data);
  words.unshift(version);

  return bech32.encode(prefix, words);
}

export function fromOutputScript(output: Buffer, network?: Network): string {
  // TODO: Network
  network = network || networks.bitcoin;

  try {
    return payments.p2pkh({ output, network }).address as string;
  } catch (e) {}
  try {
    return payments.p2sh({ output, network }).address as string;
  } catch (e) {}
  try {
    return payments.p2wpkh({ output, network }).address as string;
  } catch (e) {}
  try {
    return payments.p2wsh({ output, network }).address as string;
  } catch (e) {}

  throw new Error(bscript.toASM(output) + ' has no matching Address');
}

export function toOutputScript(address: string, network?: Network, bs58DecodeFunc?: (address: string) => any): Buffer {
  network = network || networks.bitcoin;

  let decodeBase58: Base58CheckResult | undefined;
  let decodeBech32: Bech32Result | undefined;
  try {
    decodeBase58 = fromBase58Check(address, bs58DecodeFunc);
  } catch (e) {}

  if (decodeBase58) {
    if (decodeBase58.version === network.pubKeyHash)
      return payments.p2pkh({ hash: decodeBase58.hash }).output as Buffer;
    if (decodeBase58.version === network.scriptHash)
      return payments.p2sh({ hash: decodeBase58.hash }).output as Buffer;
  } else {
    try {
      decodeBech32 = fromBech32(address);
    } catch (e) {}

    if (decodeBech32) {
      if (decodeBech32.prefix !== network.bech32)
        throw new Error(address + ' has an invalid prefix');
      if (decodeBech32.version === 0) {
        if (decodeBech32.data.length === 20)
          return payments.p2wpkh({ hash: decodeBech32.data }).output as Buffer;
        if (decodeBech32.data.length === 32)
          return payments.p2wsh({ hash: decodeBech32.data }).output as Buffer;
      }
    }
  }

  throw new Error(address + ' has no matching Script');
}
