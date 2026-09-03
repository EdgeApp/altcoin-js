/**
 * Decides, per transaction version, how a serialized transaction is framed.
 *
 * Bitcoin's framing is uniform across versions, so both questions have a
 * constant answer for it. Chains that appended their own structures after the
 * locktime — PIVX, whose version 3 carries a Sapling trailer and consequently
 * cannot be distinguished from segwit by the marker/flag bytes alone — answer
 * differently for those versions.
 */
export interface TransactionTrailerPolicy {
    /**
     * Whether a transaction of this version may carry a segwit marker and flag.
     * When false, the two bytes following the version are read as the input count
     * instead.
     */
    allowsWitness(version: number): boolean;
    /**
     * Whether bytes trailing the locktime are preserved on the transaction rather
     * than rejected as unexpected data.
     */
    preservesTrailer(version: number): boolean;
}
/** Bitcoin's framing: every version may be segwit, no version has a trailer. */
export declare const BITCOIN_TRAILER_POLICY: TransactionTrailerPolicy;
/**
 * Installs the policy used by `Transaction.fromBuffer`/`fromHex` when no policy
 * is passed explicitly.
 *
 * This is process-wide because transactions are also parsed where no coin
 * context is available — notably a PSBT input's `nonWitnessUtxo`, which `Psbt`
 * decodes internally while signing.
 */
export declare function setDefaultTrailerPolicy(policy: TransactionTrailerPolicy): void;
export declare function getDefaultTrailerPolicy(): TransactionTrailerPolicy;
export interface Output {
    script: Uint8Array;
    value: bigint;
}
export interface Input {
    hash: Uint8Array;
    index: number;
    script: Uint8Array;
    sequence: number;
    witness: Uint8Array[];
}
/**
 * Represents a Bitcoin transaction.
 */
export declare class Transaction {
    static readonly DEFAULT_SEQUENCE = 4294967295;
    static readonly SIGHASH_DEFAULT = 0;
    static readonly SIGHASH_ALL = 1;
    static readonly SIGHASH_NONE = 2;
    static readonly SIGHASH_SINGLE = 3;
    static readonly SIGHASH_ANYONECANPAY = 128;
    /**
     * Bit that selects the BIP143 sighash algorithm on chains that adopted it as
     * replay protection (Bitcoin Cash and its descendants, Bitcoin Gold). Unset
     * for Bitcoin, where the BIP143 preimage is selected by the input being
     * segwit rather than by a hashType bit.
     */
    static readonly SIGHASH_BITCOINCASHBIP143 = 64;
    static readonly SIGHASH_OUTPUT_MASK = 3;
    static readonly SIGHASH_INPUT_MASK = 128;
    static readonly ADVANCED_TRANSACTION_MARKER = 0;
    static readonly ADVANCED_TRANSACTION_FLAG = 1;
    static fromBuffer(buffer: Uint8Array, _NO_STRICT?: boolean, policy?: TransactionTrailerPolicy): Transaction;
    static fromHex(hex: string, policy?: TransactionTrailerPolicy): Transaction;
    static isCoinbaseHash(buffer: Uint8Array): boolean;
    version: number;
    locktime: number;
    ins: Input[];
    outs: Output[];
    /**
     * Bytes following the locktime, preserved verbatim for chains whose
     * `TransactionTrailerPolicy` keeps them. Undefined for Bitcoin.
     */
    trailer?: Uint8Array;
    isCoinbase(): boolean;
    addInput(hash: Uint8Array, index: number, sequence?: number, scriptSig?: Uint8Array): number;
    addOutput(scriptPubKey: Uint8Array, value: bigint): number;
    hasWitnesses(): boolean;
    stripWitnesses(): void;
    weight(): number;
    virtualSize(): number;
    byteLength(_ALLOW_WITNESS?: boolean): number;
    clone(): Transaction;
    /**
     * Hash transaction for signing a specific input.
     *
     * Bitcoin uses a different hash for each signed transaction input.
     * This method copies the transaction, makes the necessary changes based on the
     * hashType, and then hashes the result.
     * This hash can then be used to sign the provided transaction input.
     */
    hashForSignature(inIndex: number, prevOutScript: Uint8Array, hashType: number): Uint8Array;
    hashForWitnessV1(inIndex: number, prevOutScripts: Uint8Array[], values: bigint[], hashType: number, leafHash?: Uint8Array, annex?: Uint8Array): Uint8Array;
    hashForWitnessV0(inIndex: number, prevOutScript: Uint8Array, value: bigint, hashType: number): Uint8Array;
    /**
     * Hash transaction for signing a specific input on a Bitcoin Cash-style
     * fork-id chain.
     *
     * These chains select the BIP143 preimage with a hashType bit rather than by
     * the input being segwit, so a non-segwit input still signs the BIP143
     * digest. Bitcoin Cash's fork id is zero, so once that bit is set the
     * preimage is identical to BIP143's.
     */
    hashForCashSignature(inIndex: number, prevOutScript: Uint8Array, inAmount: bigint, hashType: number): Uint8Array;
    getHash(forWitness?: boolean): Uint8Array;
    getId(): string;
    toBuffer(buffer?: Uint8Array, initialOffset?: number): Uint8Array;
    toHex(): string;
    setInputScript(index: number, scriptSig: Uint8Array): void;
    setWitness(index: number, witness: Uint8Array[]): void;
    private __toBuffer;
}
