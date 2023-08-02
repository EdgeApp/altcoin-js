/// <reference types="node" />
import { Network } from './networks';
import { BaseConverter } from 'base-x';
export interface Base58CheckResult {
    hash: Buffer;
    version: number;
}
export interface Bech32Result {
    version: number;
    prefix: string;
    data: Buffer;
}
export declare function fromBase58Check(address: string, bs58DecodeFunc?: BaseConverter['decode']): Base58CheckResult;
export declare function fromBech32(address: string): Bech32Result;
export declare function toBase58Check(hash: Buffer, version: number, bs58EncodeFunc?: BaseConverter['encode']): string;
export declare function toBech32(data: Buffer, version: number, prefix: string): string;
export declare function fromOutputScript(output: Buffer, network?: Network): string;
export declare function toOutputScript(address: string, network?: Network, bs58DecodeFunc?: (address: string) => any): Buffer;
