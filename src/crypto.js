'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const createHash = require('create-hash');
const cryptoB = require('crypto-browserify');
function ripemd160(buffer) {
  try {
    return createHash('rmd160')
      .update(buffer)
      .digest();
  } catch (err) {
    return createHash('ripemd160')
      .update(buffer)
      .digest();
  }
}
exports.ripemd160 = ripemd160;
function sha1(buffer) {
  return createHash('sha1')
    .update(buffer)
    .digest();
}
exports.sha1 = sha1;
function sha256(buffer) {
  return createHash('sha256')
    .update(buffer)
    .digest();
}
exports.sha256 = sha256;
function blakeHash160(buffer) {
  return ripemd160(blake256(buffer));
}
exports.blakeHash160 = blakeHash160;
function doubleblake256(buffer) {
  return blake256(blake256(buffer));
}
exports.doubleblake256 = doubleblake256;
function blake256(buffer) {
  return cryptoB
    .createHash('blake256')
    .update(buffer)
    .digest();
}
exports.blake256 = blake256;
function hash160(buffer) {
  return ripemd160(sha256(buffer));
}
exports.hash160 = hash160;
function hash256(buffer) {
  return sha256(sha256(buffer));
}
exports.hash256 = hash256;
