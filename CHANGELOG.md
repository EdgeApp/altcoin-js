# AltcoinJS

## 1.0.0

- Forked BitcoinJS v6.1.3 cashv6 branch (bitcoinforksjs-lib)
- Changed: `SATOSHI_MAX` to `105e14` based on Groestlcoin max supply
- Added: Wide integer encoding support for legacy decred/zcash work
- Added: Custom hash function argument to `signInput` for alternatives to hash256
- Added: `nonstandard` script type to payments implementation for BCH/BSV replay protection (OP_CHECKDATASIGV technique)
- Added: Optional functions for base58 encode/decode of addresses
