/**
 * Encodes the given array of 5-bit integers as a base32-encoded string.
 *
 * @static
 * @param {Uint8Array} data Array of integers between 0 and 31 inclusive.
 * @returns {string}
 * @throws {ValidationError}
 */
export declare function encode(data: Uint8Array): string;
/**
 * Decodes the given base32-encoded string into an array of 5-bit integers.
 *
 * @static
 * @param {string} string
 * @returns {Uint8Array}
 * @throws {ValidationError}
 */
export declare function decode(strng: string): Uint8Array;
