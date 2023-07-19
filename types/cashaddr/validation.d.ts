/**
 * @license
 * https://github.com/bitcoincashjs/cashaddr
 * Copyright (c) 2017-2018 Emilio Almansi
 * Distributed under the MIT software license, see the accompanying
 * file LICENSE or http://www.opensource.org/licenses/mit-license.php.
 */
/**
 * Validation utility.
 *
 * @module validation
 */
/**
 * Error thrown when encoding or decoding fail due to invalid input.
 *
 * @constructor ValidationError
 * @param {string} message Error description.
 */
export declare class ValidationError extends Error {
    name: string;
    constructor(message?: string);
}
/**
 * Validates a given condition, throwing a {@link ValidationError} if
 * the given condition does not hold.
 *
 * @static
 * @param {boolean} condition Condition to validate.
 * @param {string} message Error message in case the condition does not hold.
 */
export declare function validate(condition: boolean, message: string): void;
