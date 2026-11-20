// jcs.mjs - JSON Canonicalization Scheme (RFC 8785). Pure, no dependency, runs in Node and in a browser.
// Object members are sorted by their UTF-16 code units, numbers use the ECMAScript serialisation, strings the JSON
// escaping of ECMAScript; no white space. Values JSON cannot carry (NaN, Infinity, undefined, functions) are refused.

export function canonicalize(value) {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('RFC 8785: a number must be finite');
      return JSON.stringify(value);
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item === undefined ? null : item)).join(',')}]`;
      const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
    }
    default:
      throw new TypeError(`RFC 8785: a ${typeof value} is not JSON`);
  }
}

const encoder = new TextEncoder();

export function bytesOf(input) {
  return typeof input === 'string' ? encoder.encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
}

export function hex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function unhex(text) {
  if (!/^([0-9a-f]{2})*$/.test(text)) throw new TypeError('not lower-case hexadecimal');
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** SHA-256 of bytes or of a string (UTF-8), as lower-case hexadecimal. WebCrypto: Node 20+ and every browser. */
export async function sha256(input) {
  return hex(await globalThis.crypto.subtle.digest('SHA-256', bytesOf(input)));
}

/** SHA-256 of the RFC 8785 form of a JSON value. */
export async function digestOf(value) {
  return sha256(canonicalize(value));
}
