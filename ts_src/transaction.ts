import { BufferReader, BufferWriter, reverseBuffer } from './bufferutils';
import * as bcrypto from './crypto';
import * as bscript from './script';
import { OPS as opcodes } from './script';
import * as types from './types';

const typeforce = require('typeforce');
const varuint = require('varuint-bitcoin');

function varSliceSize(someScript: Buffer): number {
  const length = someScript.length;

  return varuint.encodingLength(length) + length;
}

function vectorSize(someVector: Buffer[]): number {
  const length = someVector.length;

  return (
    varuint.encodingLength(length) +
    someVector.reduce((sum, witness) => {
      return sum + varSliceSize(witness);
    }, 0)
  );
}

const EMPTY_SCRIPT: Buffer = Buffer.allocUnsafe(0);
const EMPTY_WITNESS: Buffer[] = [];
const ZERO: Buffer = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000000',
  'hex',
);
const ONE: Buffer = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000001',
  'hex',
);
const VALUE_UINT64_MAX: Buffer = Buffer.from('ffffffffffffffff', 'hex');
const BLANK_OUTPUT = {
  script: EMPTY_SCRIPT,
  valueBuffer: VALUE_UINT64_MAX,
};

function isOutput(out: Output): boolean {
  return out.value !== undefined;
}

export interface Output {
  script: Buffer;
  value: number;
}

export interface Input {
  hash: Buffer;
  index: number;
  script: Buffer;
  sequence: number;
  witness: Buffer[];
}

export class Transaction {
  static readonly DEFAULT_SEQUENCE = 0xffffffff;
  static readonly SIGHASH_ALL = 0x01;
  static readonly SIGHASH_NONE = 0x02;
  static readonly SIGHASH_SINGLE = 0x03;
  static readonly SIGHASH_ANYONECANPAY = 0x80;
  static readonly SIGHASH_BITCOINCASHBIP143 = 0x40;
  static readonly ADVANCED_TRANSACTION_MARKER = 0x00;
  static readonly ADVANCED_TRANSACTION_FLAG = 0x01;
  static readonly FORKID_BTG = 0x4f; // 79
  static readonly FORKID_BCH = 0x00;

  static fromBuffer(buffer: Buffer, _NO_STRICT?: boolean): Transaction {
    const bufferReader = new BufferReader(buffer);

    const tx = new Transaction();
    tx.version = bufferReader.readInt32();

    const marker = bufferReader.readUInt8();
    const flag = bufferReader.readUInt8();

    let hasWitnesses = false;
    if (
      marker === Transaction.ADVANCED_TRANSACTION_MARKER &&
      flag === Transaction.ADVANCED_TRANSACTION_FLAG
    ) {
      hasWitnesses = true;
    } else {
      bufferReader.offset -= 2;
    }

    const vinLen = bufferReader.readVarInt();
    for (let i = 0; i < vinLen; ++i) {
      tx.ins.push({
        hash: bufferReader.readSlice(32),
        index: bufferReader.readUInt32(),
        script: bufferReader.readVarSlice(),
        sequence: bufferReader.readUInt32(),
        witness: EMPTY_WITNESS,
      });
    }

    const voutLen = bufferReader.readVarInt();
    for (let i = 0; i < voutLen; ++i) {
      tx.outs.push({
        value: bufferReader.readUInt64(),
        script: bufferReader.readVarSlice(),
      });
    }

    if (hasWitnesses) {
      for (let i = 0; i < vinLen; ++i) {
        tx.ins[i].witness = bufferReader.readVector();
      }

      // was this pointless?
      if (!tx.hasWitnesses())
        throw new Error('Transaction has superfluous witness data');
    }

    tx.locktime = bufferReader.readUInt32();

    if (_NO_STRICT) return tx;
    if (bufferReader.offset !== buffer.length)
      throw new Error('Transaction has unexpected data');

    return tx;
  }

  static fromHex(hex: string): Transaction {
    return Transaction.fromBuffer(Buffer.from(hex, 'hex'), false);
  }

  static isCoinbaseHash(buffer: Buffer): boolean {
    typeforce(types.Hash256bit, buffer);
    for (let i = 0; i < 32; ++i) {
      if (buffer[i] !== 0) return false;
    }
    return true;
  }

  version: number = 1;
  locktime: number = 0;
  ins: Input[] = [];
  outs: Output[] = [];

  isCoinbase(): boolean {
    return (
      this.ins.length === 1 && Transaction.isCoinbaseHash(this.ins[0].hash)
    );
  }

  addInput(
    hash: Buffer,
    index: number,
    sequence?: number,
    scriptSig?: Buffer,
  ): number {
    typeforce(
      types.tuple(
        types.Hash256bit,
        types.UInt32,
        types.maybe(types.UInt32),
        types.maybe(types.Buffer),
      ),
      arguments,
    );

    if (types.Null(sequence)) {
      sequence = Transaction.DEFAULT_SEQUENCE;
    }

    // Add the input and return the input's index
    return (
      this.ins.push({
        hash,
        index,
        script: scriptSig || EMPTY_SCRIPT,
        sequence: sequence as number,
        witness: EMPTY_WITNESS,
      }) - 1
    );
  }

  addOutput(scriptPubKey: Buffer, value: number): number {
    typeforce(types.tuple(types.Buffer, types.Satoshi), arguments);

    // Add the output and return the output's index
    return (
      this.outs.push({
        script: scriptPubKey,
        value,
      }) - 1
    );
  }

  hasWitnesses(): boolean {
    return this.ins.some(x => {
      return x.witness.length !== 0;
    });
  }

  weight(): number {
    const base = this.byteLength(false);
    const total = this.byteLength(true);
    return base * 3 + total;
  }

  virtualSize(): number {
    return Math.ceil(this.weight() / 4);
  }

  byteLength(_ALLOW_WITNESS: boolean = true): number {
    const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();

    return (
      (hasWitnesses ? 10 : 8) +
      varuint.encodingLength(this.ins.length) +
      varuint.encodingLength(this.outs.length) +
      this.ins.reduce((sum, input) => {
        return sum + 40 + varSliceSize(input.script);
      }, 0) +
      this.outs.reduce((sum, output) => {
        return sum + 8 + varSliceSize(output.script);
      }, 0) +
      (hasWitnesses
        ? this.ins.reduce((sum, input) => {
            return sum + vectorSize(input.witness);
          }, 0)
        : 0)
    );
  }

  clone(): Transaction {
    const newTx = new Transaction();
    newTx.version = this.version;
    newTx.locktime = this.locktime;

    newTx.ins = this.ins.map(txIn => {
      return {
        hash: txIn.hash,
        index: txIn.index,
        script: txIn.script,
        sequence: txIn.sequence,
        witness: txIn.witness,
      };
    });

    newTx.outs = this.outs.map(txOut => {
      return {
        script: txOut.script,
        value: txOut.value,
      };
    });

    return newTx;
  }

  /**
   * Hash transaction for signing a specific input.
   *
   * Bitcoin uses a different hash for each signed transaction input.
   * This method copies the transaction, makes the necessary changes based on the
   * hashType, and then hashes the result.
   * This hash can then be used to sign the provided transaction input.
   */
  hashForSignature(
    inIndex: number,
    prevOutScript: Buffer,
    hashType: number,
    hashFunction?: (Hash: Buffer) => Buffer,
  ): Buffer {
    typeforce(
      types.tuple(types.UInt32, types.Buffer, /* types.UInt8 */ types.Number),
      arguments,
    );

    // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L29
    if (inIndex >= this.ins.length) return ONE;

    // ignore OP_CODESEPARATOR
    const ourScript = bscript.compile(
      bscript.decompile(prevOutScript)!.filter(x => {
        return x !== opcodes.OP_CODESEPARATOR;
      }),
    );

    const txTmp = this.clone();

    // SIGHASH_NONE: ignore all outputs? (wildcard payee)
    if ((hashType & 0x1f) === Transaction.SIGHASH_NONE) {
      txTmp.outs = [];

      // ignore sequence numbers (except at inIndex)
      txTmp.ins.forEach((input, i) => {
        if (i === inIndex) return;

        input.sequence = 0;
      });

      // SIGHASH_SINGLE: ignore all outputs, except at the same index?
    } else if ((hashType & 0x1f) === Transaction.SIGHASH_SINGLE) {
      // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L60
      if (inIndex >= this.outs.length) return ONE;

      // truncate outputs after
      txTmp.outs.length = inIndex + 1;

      // "blank" outputs before
      for (let i = 0; i < inIndex; i++) {
        (txTmp.outs as any)[i] = BLANK_OUTPUT;
      }

      // ignore sequence numbers (except at inIndex)
      txTmp.ins.forEach((input, y) => {
        if (y === inIndex) return;

        input.sequence = 0;
      });
    }

    // SIGHASH_ANYONECANPAY: ignore inputs entirely?
    if (hashType & Transaction.SIGHASH_ANYONECANPAY) {
      txTmp.ins = [txTmp.ins[inIndex]];
      txTmp.ins[0].script = ourScript;

      // SIGHASH_ALL: only ignore input scripts
    } else {
      // "blank" others input scripts
      txTmp.ins.forEach(input => {
        input.script = EMPTY_SCRIPT;
      });
      txTmp.ins[inIndex].script = ourScript;
    }

    // serialize and hash
    const buffer: Buffer = Buffer.allocUnsafe(txTmp.byteLength(false) + 4);
    buffer.writeInt32LE(hashType, buffer.length - 4);
    txTmp.__toBuffer(buffer, 0, false);

    if (typeof hashFunction !== 'undefined') {
      return hashFunction(buffer);
    }
    return bcrypto.hash256(buffer);
  }

  hashForWitnessV0(
    inIndex: number,
    prevOutScript: Buffer,
    value: number,
    hashType: number,
    hashFunction?: (Hash: Buffer) => Buffer,
  ): Buffer {
    typeforce(
      types.tuple(types.UInt32, types.Buffer, types.Satoshi, types.UInt32),
      arguments,
    );

    let tbuffer: Buffer = Buffer.from([]);
    let bufferWriter: BufferWriter;

    let hashOutputs = ZERO;
    let hashPrevouts = ZERO;
    let hashSequence = ZERO;

    if (!(hashType & Transaction.SIGHASH_ANYONECANPAY)) {
      tbuffer = Buffer.allocUnsafe(36 * this.ins.length);
      bufferWriter = new BufferWriter(tbuffer, 0);

      this.ins.forEach(txIn => {
        bufferWriter.writeSlice(txIn.hash);
        bufferWriter.writeUInt32(txIn.index);
      });

      hashPrevouts = bcrypto.hash256(tbuffer);
      if (typeof hashFunction !== 'undefined') {
        hashPrevouts = hashFunction(tbuffer);
      }
    }

    if (
      !(hashType & Transaction.SIGHASH_ANYONECANPAY) &&
      (hashType & 0x1f) !== Transaction.SIGHASH_SINGLE &&
      (hashType & 0x1f) !== Transaction.SIGHASH_NONE
    ) {
      tbuffer = Buffer.allocUnsafe(4 * this.ins.length);
      bufferWriter = new BufferWriter(tbuffer, 0);

      this.ins.forEach(txIn => {
        bufferWriter.writeUInt32(txIn.sequence);
      });

      hashSequence = bcrypto.hash256(tbuffer);
      if (typeof hashFunction !== 'undefined') {
        hashSequence = hashFunction(tbuffer);
      }
    }

    if (
      (hashType & 0x1f) !== Transaction.SIGHASH_SINGLE &&
      (hashType & 0x1f) !== Transaction.SIGHASH_NONE
    ) {
      const txOutsSize = this.outs.reduce((sum, output) => {
        return sum + 8 + varSliceSize(output.script);
      }, 0);

      tbuffer = Buffer.allocUnsafe(txOutsSize);
      bufferWriter = new BufferWriter(tbuffer, 0);

      this.outs.forEach(out => {
        bufferWriter.writeUInt64(out.value);
        bufferWriter.writeVarSlice(out.script);
      });

      hashOutputs = bcrypto.hash256(tbuffer);
      if (typeof hashFunction !== 'undefined') {
        hashOutputs = hashFunction(tbuffer);
      }
    } else if (
      (hashType & 0x1f) === Transaction.SIGHASH_SINGLE &&
      inIndex < this.outs.length
    ) {
      const output = this.outs[inIndex];

      tbuffer = Buffer.allocUnsafe(8 + varSliceSize(output.script));
      bufferWriter = new BufferWriter(tbuffer, 0);
      bufferWriter.writeUInt64(output.value);
      bufferWriter.writeVarSlice(output.script);

      hashOutputs = bcrypto.hash256(tbuffer);
      if (typeof hashFunction !== 'undefined') {
        hashOutputs = hashFunction(tbuffer);
      }
    }

    tbuffer = Buffer.allocUnsafe(156 + varSliceSize(prevOutScript));
    bufferWriter = new BufferWriter(tbuffer, 0);

    const input = this.ins[inIndex];
    bufferWriter.writeUInt32(this.version);
    bufferWriter.writeSlice(hashPrevouts);
    bufferWriter.writeSlice(hashSequence);
    bufferWriter.writeSlice(input.hash);
    bufferWriter.writeUInt32(input.index);
    bufferWriter.writeVarSlice(prevOutScript);
    bufferWriter.writeUInt64(value);
    bufferWriter.writeUInt32(input.sequence);
    bufferWriter.writeSlice(hashOutputs);
    bufferWriter.writeUInt32(this.locktime);
    bufferWriter.writeUInt32(hashType);
    if (typeof hashFunction !== 'undefined') {
      return hashFunction(tbuffer);
    }
    return bcrypto.hash256(tbuffer);
  }

  /**
   * Hash transaction for signing a specific input for Bitcoin Cash.
   */
  hashForCashSignature(
    inIndex: number,
    prevOutScript: Buffer,
    inAmount: number,
    hashType: number,
  ): Buffer {
    typeforce(
      types.tuple(
        types.UInt32,
        types.Buffer,
        /* types.UInt8 */ types.Number,
        types.maybe(types.UInt53),
      ),
      arguments,
    );

    // This function works the way it does because Bitcoin Cash
    // uses BIP143 as their replay protection, AND their algo
    // includes `forkId | hashType`, AND since their forkId=0,
    // this is a NOP, and has no difference to segwit. To support
    // other forks, another parameter is required, and a new parameter
    // would be required in the hashForWitnessV0 function, or
    // it could be broken into two..

    // BIP143 sighash activated in BitcoinCash via 0x40 bit
    if (hashType & Transaction.SIGHASH_BITCOINCASHBIP143) {
      if (types.Null(inAmount)) {
        throw new Error(
          'Bitcoin Cash sighash requires value of input to be signed.',
        );
      }
      return this.hashForWitnessV0(inIndex, prevOutScript, inAmount, hashType);
    } else {
      return this.hashForSignature(inIndex, prevOutScript, hashType);
    }
  }

  /**
   * Hash transaction for signing a specific input for Bitcoin Gold.
   */
  hashForGoldSignature(
    inIndex: number,
    prevOutScript: Buffer,
    inAmount: number,
    hashType: number,
    sigVersion?: boolean,
  ): Buffer {
    typeforce(
      types.tuple(
        types.UInt32,
        types.Buffer,
        /* types.UInt8 */ types.Number,
        types.maybe(types.UInt53),
      ),
      arguments,
    );

    // Bitcoin Gold also implements segregated witness
    // therefore we can pull out the setting of nForkHashType
    // and pass it into the functions.

    let nForkHashType = hashType;
    const fUseForkId = (hashType & Transaction.SIGHASH_BITCOINCASHBIP143) > 0;
    if (fUseForkId) {
      nForkHashType |= Transaction.FORKID_BTG << 8;
    }

    // BIP143 sighash activated in BitcoinCash via 0x40 bit
    if (sigVersion || fUseForkId) {
      if (types.Null(inAmount)) {
        throw new Error(
          'Bitcoin Cash sighash requires value of input to be signed.',
        );
      }
      return this.hashForWitnessV0(
        inIndex,
        prevOutScript,
        inAmount,
        nForkHashType,
      );
    } else {
      return this.hashForSignature(inIndex, prevOutScript, nForkHashType);
    }
  }

  getHash(
    forWitness?: boolean,
    hashFunction?: (Hash: Buffer) => Buffer,
  ): Buffer {
    // wtxid for coinbase is always 32 bytes of 0x00
    if (forWitness && this.isCoinbase()) return Buffer.alloc(32, 0);
    if (typeof hashFunction !== 'undefined') {
      return hashFunction(this.__toBuffer(undefined, undefined, forWitness));
    }
    return bcrypto.hash256(this.__toBuffer(undefined, undefined, forWitness));
  }

  getId(hashFunction?: (Hash: Buffer) => Buffer): string {
    // transaction hash's are displayed in reverse order
    return reverseBuffer(this.getHash(false, hashFunction)).toString('hex');
  }

  toBuffer(buffer?: Buffer, initialOffset?: number): Buffer {
    return this.__toBuffer(buffer, initialOffset, true);
  }

  toHex(): string {
    return this.toBuffer(undefined, undefined).toString('hex');
  }

  setInputScript(index: number, scriptSig: Buffer): void {
    typeforce(types.tuple(types.Number, types.Buffer), arguments);

    this.ins[index].script = scriptSig;
  }

  setWitness(index: number, witness: Buffer[]): void {
    typeforce(types.tuple(types.Number, [types.Buffer]), arguments);

    this.ins[index].witness = witness;
  }

  private __toBuffer(
    buffer?: Buffer,
    initialOffset?: number,
    _ALLOW_WITNESS: boolean = false,
  ): Buffer {
    if (!buffer)
      buffer = Buffer.allocUnsafe(this.byteLength(_ALLOW_WITNESS)) as Buffer;

    const bufferWriter = new BufferWriter(buffer, initialOffset || 0);

    bufferWriter.writeInt32(this.version);

    const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();

    if (hasWitnesses) {
      bufferWriter.writeUInt8(Transaction.ADVANCED_TRANSACTION_MARKER);
      bufferWriter.writeUInt8(Transaction.ADVANCED_TRANSACTION_FLAG);
    }

    bufferWriter.writeVarInt(this.ins.length);

    this.ins.forEach(txIn => {
      bufferWriter.writeSlice(txIn.hash);
      bufferWriter.writeUInt32(txIn.index);
      bufferWriter.writeVarSlice(txIn.script);
      bufferWriter.writeUInt32(txIn.sequence);
    });

    bufferWriter.writeVarInt(this.outs.length);
    this.outs.forEach(txOut => {
      if (isOutput(txOut)) {
        bufferWriter.writeUInt64(txOut.value);
      } else {
        bufferWriter.writeSlice((txOut as any).valueBuffer);
      }

      bufferWriter.writeVarSlice(txOut.script);
    });

    if (hasWitnesses) {
      this.ins.forEach(input => {
        bufferWriter.writeVector(input.witness);
      });
    }

    bufferWriter.writeUInt32(this.locktime);

    // avoid slicing unless necessary
    if (initialOffset !== undefined)
      return buffer.slice(initialOffset, bufferWriter.offset);
    return buffer;
  }
}
