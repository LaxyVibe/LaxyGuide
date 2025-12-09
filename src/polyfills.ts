import { Buffer } from 'buffer';

// Polyfill Buffer for gray-matter
// @ts-ignore
globalThis.Buffer = Buffer;
