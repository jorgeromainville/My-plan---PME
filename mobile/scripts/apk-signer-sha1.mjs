// Extrae el certificado con el que está firmado un APK (esquema v2) y compara
// su SHA-1 con la huella esperada. Sin Java ni Android SDK.
//
//   node scripts/apk-signer-sha1.mjs <ruta.apk> [sha1-esperado]
import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';

const [, , apkPath, expected] = process.argv;
if (!apkPath) {
  console.error('Uso: node scripts/apk-signer-sha1.mjs <ruta.apk> [sha1-esperado]');
  process.exit(1);
}

const buf = readFileSync(apkPath);

// 1) Localizar el End Of Central Directory (firma 0x06054b50) desde el final.
let eocd = -1;
for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
  if (buf.readUInt32LE(i) === 0x06054b50) {
    eocd = i;
    break;
  }
}
if (eocd < 0) throw new Error('No se encontró el EOCD: no parece un ZIP válido.');

const centralDirOffset = buf.readUInt32LE(eocd + 16);

// 2) Bloque de firma: [tamaño 8][pares][tamaño 8][magic 16] justo antes del
//    directorio central.
const MAGIC = 'APK Sig Block 42';
if (buf.subarray(centralDirOffset - 16, centralDirOffset).toString('binary') !== MAGIC) {
  throw new Error('No hay APK Signing Block (el APK no está firmado con v2/v3).');
}
const blockSize = Number(buf.readBigUInt64LE(centralDirOffset - 24));
const blockStart = centralDirOffset - blockSize - 8;

// 3) Recorrer los pares id/valor buscando el esquema v2 (0x7109871a).
let offset = blockStart + 8;
let v2 = null;
while (offset < centralDirOffset - 24) {
  const pairLen = Number(buf.readBigUInt64LE(offset));
  const id = buf.readUInt32LE(offset + 8);
  const value = buf.subarray(offset + 12, offset + 8 + pairLen);
  if (id === 0x7109871a) v2 = value;
  offset += 8 + pairLen;
}
if (!v2) throw new Error('El APK no tiene bloque v2.');

// 4) v2: secuencia de firmantes → datos firmados → certificados.
function readLenPrefixed(view, at) {
  const len = view.readUInt32LE(at);
  return { value: view.subarray(at + 4, at + 4 + len), next: at + 4 + len };
}

const signers = readLenPrefixed(v2, 0).value;
if (signers.readUInt32LE(0) === 0) throw new Error('Sin firmantes en el bloque v2.');
const signer = readLenPrefixed(signers, 0).value;
const signedData = readLenPrefixed(signer, 0).value;
const digests = readLenPrefixed(signedData, 0); // lista de digests (no usada)
const certsAt = digests.next;
const certs = readLenPrefixed(signedData, certsAt).value;
const firstCert = readLenPrefixed(certs, 0).value;

const cert = new X509Certificate(firstCert);
const sha1 = cert.fingerprint;
const sha256 = cert.fingerprint256;

console.log(`APK        : ${apkPath}`);
console.log(`subject    : ${cert.subject.replace(/\n/g, ', ')}`);
console.log(`SHA-1      : ${sha1}`);
console.log(`SHA-256    : ${sha256}`);
console.log(`válido     : ${cert.validFrom} -> ${cert.validTo}`);

if (expected) {
  const norm = (s) => s.replace(/[^0-9a-f]/gi, '').toUpperCase();
  const ok = norm(sha1) === norm(expected);
  console.log(ok ? 'FIRMA: coincide con la esperada' : 'FIRMA: NO coincide con la esperada');
  process.exit(ok ? 0 : 1);
}
