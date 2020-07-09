interface Base58BaseReturn {
    encode: (payload: Buffer) => string;
    decode: (stringPayload: string) => Buffer;
    decodeUnsafe: (stringPayload: string) => Buffer | undefined;
}
export declare function base58Base(checksumFn: (buffer: Buffer) => Buffer): Base58BaseReturn;
export {};
