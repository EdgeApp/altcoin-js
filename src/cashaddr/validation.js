'use strict';
/**
 * @license
 * https://github.com/bitcoincashjs/cashaddr
 * Copyright (c) 2017-2018 Emilio Almansi
 * Distributed under the MIT software license, see the accompanying
 * file LICENSE or http://www.opensource.org/licenses/mit-license.php.
 */
Object.defineProperty(exports, '__esModule', { value: true });
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
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
exports.ValidationError = ValidationError;
/**
 * Validates a given condition, throwing a {@link ValidationError} if
 * the given condition does not hold.
 *
 * @static
 * @param {boolean} condition Condition to validate.
 * @param {string} message Error message in case the condition does not hold.
 */
function validate(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}
exports.validate = validate;
