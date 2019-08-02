/* global describe, it */

var assert = require('assert')
var payments = require('../src/payments')
var bcrypto = require('../src/crypto')
var ECPair = require('../src/ecpair')
var NETWORKS = require('../src/networks')
var TransactionBuilder = require('../src/transaction_builder').TransactionBuilder
var Transaction = require('../src/transaction').Transaction

console.warn = () => {} // Silence the Deprecation Warning

describe('TransactionBuilder', function () {
  var network = NETWORKS['bitcoingold']
  it('goldtestcase', function () {
    var value = 50 * 1e8
    var txid = '40c8a218923f23df3692530fa8e475251c50c7d630dccbdfbd92ba8092f4aa13'
    var vout = 0

    var wif = 'L54PmHcjKXi8H6v9cLAJ7DgGJFDpaFpR2YsV2WARieb82dz3QAfr'
    var keyPair = ECPair.fromWIF(wif, network)

    var pk = bcrypto.hash160(keyPair.publicKey)
    var spk = payments.p2pkh({ hash: pk }).output

    var txb = new TransactionBuilder(network)
    txb.addInput(txid, vout, Transaction.DEFAULT_SEQUENCE, spk)
    txb.addOutput('GfEHv6hKvAX8HYfFzabMY2eiYDtC9eViqe', value)
    txb.enableBitcoinGold(true)
    txb.setVersion(2)

    var hashType = Transaction.SIGHASH_ALL | Transaction.SIGHASH_BITCOINCASHBIP143

    txb.sign(0, keyPair, null, hashType, value)

    var tx = txb.build()
    var hex = tx.toHex()
    assert.equal(
      '020000000113aaf49280ba92bddfcbdc30d6c7501c2575e4a80f539236df233f9218a2' +
      'c840000000006b483045022100c594c8e0750b1b6ec4e267b6d6c7098840f86fa9467f' +
      '8aa452f439c3a72e0cd9022019759d800fffd7fcb78d16468f5693ea07a13da33607e0' +
      'e8fbb4cdb5967075b441210201ad6a9a15457b162a71f1d5db8fe27ff001abc4ae3a88' +
      '8214f9407cb0da863cffffffff0100f2052a010000001976a914ea95bd5087d3b5f2df' +
      '279304a46ad827225c4e8688ac00000000',
      hex,
    )
  })

  it('goldtestcase_multisig_1', function () {
    var value = 50 * 1e8

    var txHex =
      '020000000113aaf49280ba92bddfcbdc30d6c7501c2575e4a80f539236df233f9218a2' +
      'c840000000009200483045022100b3b4211b8e8babc667dcca0b6f1c1284f191170a38' +
      'a59bc3b9d7541d68c3c7a002200196267b87a7b80f3f556b3372e5ee6ed19b4b9e802c' +
      '34916f45bc2b11d2de1a414752210201ad6a9a15457b162a71f1d5db8fe27ff001abc4' +
      'ae3a888214f9407cb0da863c2103e6533849994cf76a9009447f2ad6dbf84c78e6f5f4' +
      '8fe77cf83cd9a3fe2e30ec52aeffffffff0100f2052a010000001976a914ea95bd5087' +
      'd3b5f2df279304a46ad827225c4e8688ac00000000'
    var tx = Transaction.fromHex(txHex)
    tx.ins[0].value = value

    var txb = TransactionBuilder.fromTransaction(tx, network, Transaction.FORKID_BTG)

    assert.equal(undefined, txb.__INPUTS[0].signatures[0])
    assert.equal(
      '3045022100b3b4211b8e8babc667dcca0b6f1c1284f191170a38a59bc3b9d7541d68c3' +
      'c7a002200196267b87a7b80f3f556b3372e5ee6ed19b4b9e802c34916f45bc2b11d2de' +
      '1a41',
      txb.__INPUTS[0].signatures[1].toString('hex')
    )

    var hex = txb.build().toHex()
    assert.equal(txHex, hex)
  })

  it('goldtestcase_multisig_0', function () {
    var value = 50 * 1e8

    var txHex =
      '020000000113aaf49280ba92bddfcbdc30d6c7501c2575e4a80f539236df233f9218a2' +
      'c840000000009100473044022025cb6ee7a63c7403645be2ed4ffcf9cd41d773ee3ba5' +
      '7a05dc335c4427f647660220323a038daac698efdc700ffa8d90e6641ed9eb4ab82808' +
      'df0506a9da08863d29414752210201ad6a9a15457b162a71f1d5db8fe27ff001abc4ae' +
      '3a888214f9407cb0da863c2103e6533849994cf76a9009447f2ad6dbf84c78e6f5f48f' +
      'e77cf83cd9a3fe2e30ec52aeffffffff0100f2052a010000001976a914ea95bd5087d3' +
      'b5f2df279304a46ad827225c4e8688ac00000000'
    var tx = Transaction.fromHex(txHex)
    tx.ins[0].value = value

    var txb = TransactionBuilder.fromTransaction(tx, network, Transaction.FORKID_BTG)

    assert.equal(
      '3044022025cb6ee7a63c7403645be2ed4ffcf9cd41d773ee3ba57a05dc335c4427f647' +
      '660220323a038daac698efdc700ffa8d90e6641ed9eb4ab82808df0506a9da08863d29' +
      '41',
      txb.__INPUTS[0].signatures[0].toString('hex')
    )
    assert.equal(undefined, txb.__INPUTS[0].signatures[1])

    var hex = txb.build().toHex()
    assert.equal(txHex, hex)
  })
})