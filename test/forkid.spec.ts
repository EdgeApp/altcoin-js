import * as assert from 'assert';
import { describe, it } from 'mocha';
import { networks, payments, Psbt, script as bscript, Transaction } from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as tools from 'uint8array-tools';

const ECPair = ECPairFactory(ecc);

/**
 * Signing on the fork-id chains: Bitcoin Cash, Bitcoin SV and eCash. These
 * select the BIP143 preimage with a hashType bit rather than by the input being
 * segwit.
 *
 * Also covers the replay-protection redeem script these chains use, which
 * matches no standard template and so classifies as `nonstandard`.
 */
describe('fork-id signing', () => {
  const keyPair = ECPair.fromPrivateKey(
    tools.fromHex(
      '0000000000000000000000000000000000000000000000000000000000000001',
    ),
  );
  const pubkey = keyPair.publicKey;
  const value = 100000n;

  // A P2PKH transaction with one input and one output.
  const txHex =
    '0100000001c7a77aeadf529759c8db9b3f205d690cdaed3df0eaf441ead648086e' +
    '85a6a2800000000000ffffffff0100f2052a010000001976a914aa4d7985c57e01' +
    '1a8b3dd8e0e5a73aaef41629c588ac00000000';
  const prevOutScript = tools.fromHex(
    '76a914aa4d7985c57e011a8b3dd8e0e5a73aaef41629c588ac',
  );

  /** A one-input, one-output transaction spending the given scriptPubkey. */
  function makePsbt(scriptPubkey: Uint8Array, sighashType: number, redeemScript?: Uint8Array): Psbt {
    const psbt = new Psbt({ network: networks.bitcoin });
    psbt.addInput({
      hash: tools.fromHex(
        '0000000000000000000000000000000000000000000000000000000000000001',
      ),
      index: 0,
      sighashType,
      witnessUtxo: { script: scriptPubkey, value },
      ...(redeemScript === undefined ? {} : { redeemScript }),
    });
    psbt.addOutput({
      script: payments.p2pkh({ pubkey, network: networks.bitcoin }).output!,
      value: value - 1000n,
    });
    return psbt;
  }

  describe('Bitcoin Cash', () => {
    it('signs a P2PKH input with the BIP143 preimage and finalizes', () => {
      const p2pkh = payments.p2pkh({ pubkey, network: networks.bitcoin });
      const psbt = makePsbt(p2pkh.output!, Psbt.BCH_SIGHASH_ALL);

      psbt.signInput(0, keyPair, Psbt.DEFAULT_SIGHASHES);
      assert.ok(
        psbt.validateSignaturesOfInput(0, (pk, msghash, signature) =>
          ECPair.fromPublicKey(pk).verify(msghash, signature),
        ),
      );
      psbt.finalizeInput(0);

      const tx = psbt.extractTransaction();
      assert.strictEqual(tx.ins.length, 1);

      // The signature carries only the low byte of the hashType.
      const sig = bscript.decompile(tx.ins[0].script)![0] as Uint8Array;
      assert.strictEqual(
        bscript.signature.decode(sig).hashType,
        Psbt.BCH_SIGHASH_ALL,
      );

      // And the digest signed is BIP143's, not the legacy one, even though the
      // input is not segwit.
      const unsigned = psbt.__CACHE.__TX as Transaction;
      const bip143 = unsigned.hashForWitnessV0(
        0,
        p2pkh.output!,
        value,
        Psbt.BCH_SIGHASH_ALL,
      );
      assert.ok(
        ECPair.fromPublicKey(pubkey).verify(
          bip143,
          bscript.signature.decode(sig).signature,
        ),
      );
    });

    it('rejects a fork-id sighash when the allowlist omits it', () => {
      const p2pkh = payments.p2pkh({ pubkey, network: networks.bitcoin });
      const psbt = makePsbt(p2pkh.output!, Psbt.BCH_SIGHASH_ALL);

      // This is the failure mode that makes DEFAULT_SIGHASHES load-bearing:
      // narrowing the allowlist to Bitcoin's own SIGHASH_ALL locks the chain out.
      assert.throws(
        () => psbt.signInput(0, keyPair, [Transaction.SIGHASH_ALL]),
        /sighash type/i,
      );
    });
  });

  describe('replay-protection redeem script', () => {
    // Shaped after the OP_CHECKDATASIGVERIFY template Bitcoin Cash and Bitcoin
    // SV use: <cdsSig> <cdsMsg> <cdsPubkey> OP_CHECKDATASIGVERIFY <pubkey>
    // OP_CHECKSIG. It spends with a single signature but matches no standard
    // template, so it classifies as `nonstandard`.
    const OP_CHECKDATASIGVERIFY = 0xbb;
    const cdsSig = tools.fromHex(
      '30440220256c12175e809381f97637933ed6ab97737d263eaaebca6add21bced67fd12a4' +
        '02205ce29ecc1369d6fc1b51977ed38faaf41119e3be1d7edfafd7cfaf0b6061bd07',
    );
    const cdsPubkey = tools.fromHex(
      '038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508',
    );
    const redeemScript = bscript.compile([
      cdsSig,
      new Uint8Array(0),
      cdsPubkey,
      OP_CHECKDATASIGVERIFY,
      pubkey,
      bscript.OPS.OP_CHECKSIG,
    ]);

    it('matches no standard payment template', () => {
      // This is what makes the script classify as `nonstandard`, and so what
      // makes the handling under test necessary.
      for (const payment of [
        payments.p2pkh,
        payments.p2sh,
        payments.p2pk,
        payments.p2ms,
        payments.p2wpkh,
        payments.p2wsh,
      ]) {
        assert.throws(() => payment({ output: redeemScript }));
      }
    });

    it('signs and finalizes to a scriptSig of just the signature and redeem script', () => {
      const p2sh = payments.p2sh({
        redeem: { output: redeemScript },
        network: networks.bitcoin,
      });
      const psbt = makePsbt(p2sh.output!, Psbt.BCH_SIGHASH_ALL, redeemScript);

      psbt.signInput(0, keyPair, Psbt.DEFAULT_SIGHASHES);
      psbt.finalizeInput(0);

      const scriptSig = psbt.extractTransaction().ins[0].script;
      const chunks = bscript.decompile(scriptSig)!;

      // Exactly two pushes: the signature, then the redeem script. A standard
      // p2sh wrapping would have pushed the redeem script a second time.
      assert.strictEqual(chunks.length, 2);
      assert.deepStrictEqual(chunks[1], redeemScript);

      const sig = chunks[0] as Uint8Array;
      assert.strictEqual(
        bscript.signature.decode(sig).hashType,
        Psbt.BCH_SIGHASH_ALL,
      );
    });
  });

  describe('constants and allowlist', () => {
    it('exposes the fork-id constants', () => {
      assert.strictEqual(Transaction.SIGHASH_BITCOINCASHBIP143, 0x40);
      assert.strictEqual(Psbt.BCH_SIGHASH_ALL, 0x41);
    });

    it('allows every fork-id SIGHASH_ALL through the default allowlist', () => {
      // signInput rejects any sighashType absent from this list, so a fork-id
      // chain cannot be signed unless its SIGHASH_ALL appears here.
      assert.ok(Psbt.DEFAULT_SIGHASHES.includes(Transaction.SIGHASH_ALL));
      assert.ok(Psbt.DEFAULT_SIGHASHES.includes(Psbt.BCH_SIGHASH_ALL));
    });

    it('treats a fork-id hashType as defined so signatures can be encoded', () => {
      // Without masking the fork-id bit, script_signature.encode throws
      // 'Invalid hashType 65' and no fork-id chain can be signed at all.
      assert.strictEqual(bscript.isDefinedHashType(Psbt.BCH_SIGHASH_ALL), true);
      assert.strictEqual(
        bscript.isDefinedHashType(Transaction.SIGHASH_ALL),
        true,
      );
      assert.strictEqual(bscript.isDefinedHashType(0x00), false);
      assert.strictEqual(bscript.isDefinedHashType(0x04), false);
    });

    it('signs a fork-id input with the BIP143 preimage', () => {
      const tx = Transaction.fromHex(txHex);

      // The fork-id bit selects the BIP143 preimage for an input that is not
      // segwit, which is exactly what hashForSignature would not do.
      const cash = tx.hashForCashSignature(
        0,
        prevOutScript,
        1n,
        Psbt.BCH_SIGHASH_ALL,
      );
      assert.deepStrictEqual(
        cash,
        tx.hashForWitnessV0(0, prevOutScript, 1n, Psbt.BCH_SIGHASH_ALL),
      );

      // With the bit clear it falls back to the legacy digest.
      assert.deepStrictEqual(
        tx.hashForCashSignature(0, prevOutScript, 1n, Transaction.SIGHASH_ALL),
        tx.hashForSignature(0, prevOutScript, Transaction.SIGHASH_ALL),
      );
    });

  });
});
