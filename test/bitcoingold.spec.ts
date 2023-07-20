import * as assert from 'assert';
import * as payments from '../src/payments';
import * as bcrypto from '../src/crypto';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as NETWORKS from '../src/networks';
import { Transaction } from '../src/transaction';
import { Psbt } from '../src/psbt';

const ECPair = ECPairFactory(ecc);

describe('Psbt for Bitcoin Gold', function () {
  const network = NETWORKS['bitcoingold'];
  it('Bitcoin Gold test case', function () {
    const value = 50 * 1e8;
    const txid =
      '40c8a218923f23df3692530fa8e475251c50c7d630dccbdfbd92ba8092f4aa13';
    const vout = 0;

    const wif = 'L54PmHcjKXi8H6v9cLAJ7DgGJFDpaFpR2YsV2WARieb82dz3QAfr';
    const keyPair = ECPair.fromWIF(wif, network);

    const pk = bcrypto.hash160(keyPair.publicKey);
    const spk = payments.p2pkh({ hash: pk }).output!;

    const hashType =
      Transaction.SIGHASH_ALL | Transaction.SIGHASH_BITCOINCASHBIP143;
    const hashTypeForPsbt = hashType | (Transaction.FORKID_BTG << 8);

    // Psbt
    const psbt = new Psbt({ network });
    const hexPsbt = psbt
      .addInput({
        hash: txid,
        index: vout,
        sequence: Transaction.DEFAULT_SEQUENCE,
        witnessUtxo: {
          script: spk,
          value,
        },
        sighashType: hashTypeForPsbt, // This is how you tell Psbt it is forkid!!!
      })
      .addOutput({
        address: 'GfEHv6hKvAX8HYfFzabMY2eiYDtC9eViqe',
        value,
      })
      .signInput(0, keyPair)
      .finalizeAllInputs()
      .extractTransaction()
      .toHex();

    const result =
      '020000000113aaf49280ba92bddfcbdc30d6c7501c2575e4a80f539236df233f9218a2' +
      'c840000000006b483045022100c594c8e0750b1b6ec4e267b6d6c7098840f86fa9467f' +
      '8aa452f439c3a72e0cd9022019759d800fffd7fcb78d16468f5693ea07a13da33607e0' +
      'e8fbb4cdb5967075b441210201ad6a9a15457b162a71f1d5db8fe27ff001abc4ae3a88' +
      '8214f9407cb0da863cffffffff0100f2052a010000001976a914ea95bd5087d3b5f2df' +
      '279304a46ad827225c4e8688ac00000000';
    assert.equal(result, hexPsbt);
  });
  // Removed: multisig tests were testing a small internal feature of
  // TransactionBuilder which is no longer relevant.
});
