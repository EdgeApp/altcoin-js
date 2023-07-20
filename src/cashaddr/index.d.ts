/**
 * @license
 * https://github.com/bitcoincashjs/cashaddr
 * Copyright (c) 2017-2018 Emilio Almansi
 * Distributed under the MIT software license, see the accompanying
 * file LICENSE or http://www.opensource.org/licenses/mit-license.php.
 */
import * as validation from './validation';
/**
 * Encoding and decoding of the new Cash Address format for Bitcoin Cash. <br />
 * Compliant with the original cashaddr specification:
 * {@link https://github.com/Bitcoin-UAHF/spec/blob/master/cashaddr.md}
 * @module cashaddr
 */
/**
 * Encodes a hash from a given type into a Bitcoin Cash address with the given prefix.
 *
 * @static
 * @param {string} prefix Network prefix. E.g.: 'bitcoincash'.
 * @param {string} type Type of address to generate. Either 'P2PKH' or 'P2SH'.
 * @param {Uint8Array} hash Hash to encode represented as an array of 8-bit integers.
 * @returns {string}
 * @throws {ValidationError}
 */
export declare function encode(prefix: string, type: string, hash: Uint8Array): string;
interface DecodedAddress {
    prefix: string;
    type: string;
    hash: Uint8Array;
}
/**
 * Decodes the given address into its constituting prefix, type and hash. See [#encode()]{@link encode}.
 *
 * @static
 * @param {string} address Address to decode. E.g.: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'.
 * @returns {object}
 * @throws {ValidationError}
 */
export declare function decode(address: string): DecodedAddress;
/**
 * Error thrown when encoding or decoding fail due to invalid input.
 *
 * @constructor ValidationError
 * @param {string} message Error description.
 */
export declare const ValidationError: typeof validation.ValidationError;
/**
 * Valid address prefixes.
 *
 * @private
 */
export declare const VALID_PREFIXES: string[];
export {};
