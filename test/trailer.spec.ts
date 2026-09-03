import * as assert from 'assert';
import { describe, it } from 'mocha';
import { Transaction } from 'bitcoinjs-lib';
import {
  BITCOIN_TRAILER_POLICY,
  TransactionTrailerPolicy,
} from 'bitcoinjs-lib/src/transaction';
import * as tools from 'uint8array-tools';

/**
 * PIVX appends Sapling data after the locktime, which vanilla parsing rejects.
 * These assert both that Bitcoin's framing is untouched and that an opted-in
 * version really does preserve and re-serialize its trailer.
 */
describe('transaction trailer policy', () => {
  // A P2PKH transaction with one input and one output.
  const txHex =
    '0100000001c7a77aeadf529759c8db9b3f205d690cdaed3df0eaf441ead648086e' +
    '85a6a2800000000000ffffffff0100f2052a010000001976a914aa4d7985c57e01' +
    '1a8b3dd8e0e5a73aaef41629c588ac00000000';
  const prevOutScript = tools.fromHex(
    '76a914aa4d7985c57e011a8b3dd8e0e5a73aaef41629c588ac',
  );

  describe('policy', () => {
    const withTrailer = txHex + 'deadbeef';

    it('rejects trailing data by default', () => {
      assert.throws(
        () => Transaction.fromHex(withTrailer),
        /Transaction has unexpected data/,
      );
      assert.strictEqual(
        BITCOIN_TRAILER_POLICY.allowsWitness(3),
        true,
        'Bitcoin allows a segwit marker on every version',
      );
      assert.strictEqual(BITCOIN_TRAILER_POLICY.preservesTrailer(3), false);
    });

    it('preserves and re-serializes a trailer for an opted-in version', () => {
      // Shaped after PIVX, whose version 3 carries a Sapling trailer and so
      // cannot be read as segwit.
      const policy: TransactionTrailerPolicy = {
        allowsWitness: version => version !== 3,
        preservesTrailer: version => version === 3,
      };

      // Version 1 still rejects a trailer under the same policy.
      assert.throws(
        () => Transaction.fromHex(withTrailer, policy),
        /Transaction has unexpected data/,
      );

      const v3Hex = '03000000' + withTrailer.slice(8);
      const tx = Transaction.fromHex(v3Hex, policy);
      assert.deepStrictEqual(tx.trailer, tools.fromHex('deadbeef'));
      // byteLength must account for the trailer or toBuffer writes past its
      // allocation, and the round-trip must be byte-identical.
      assert.strictEqual(tx.byteLength(), v3Hex.length / 2);
      assert.strictEqual(tx.toHex(), v3Hex);
      assert.deepStrictEqual(tx.clone().trailer, tx.trailer);
    });
  });
});
