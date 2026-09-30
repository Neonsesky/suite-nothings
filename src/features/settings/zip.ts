/**
 * Dependency-free ZIP (STORE method only — no compression, just CRC-32 + headers). Enough to
 * build our export archive and to read it back for import. Not a general-purpose unzip: it
 * assumes every entry is STORE-compressed, which is all `zipFiles` ever writes.
 */

let crcTable: Uint32Array | null = null;
function table(): Uint32Array {
  if (crcTable) return crcTable;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  crcTable = t;
  return t;
}

/** CRC-32 (IEEE 802.3) of a byte buffer. `crc32(utf8("123456789")) === 0xCBF43926`. */
export function crc32(data: Uint8Array): number {
  const t = table();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private len = 0;
  u8(v: number) {
    this.chunks.push(Uint8Array.of(v & 0xff));
    this.len += 1;
  }
  u16(v: number) {
    this.chunks.push(Uint8Array.of(v & 0xff, (v >>> 8) & 0xff));
    this.len += 2;
  }
  u32(v: number) {
    this.chunks.push(Uint8Array.of(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff));
    this.len += 4;
  }
  bytes(b: Uint8Array) {
    this.chunks.push(b);
    this.len += b.length;
  }
  get length() {
    return this.len;
  }
  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.len);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }
}

export interface ZipEntryInput {
  name: string;
  data: string | Uint8Array;
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const UTF8_FLAG = 0x0800;

/** Builds a STORE-only ZIP (no compression) with UTF-8 names/content flagged. */
export function zipFiles(files: readonly ZipEntryInput[], date: Date = new Date()): Blob {
  const enc = new TextEncoder();
  const { time, date: dosDate } = dosDateTime(date);
  const local = new ByteWriter();
  const central: { nameBytes: Uint8Array; crc: number; size: number; offset: number }[] = [];

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const dataBytes = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(dataBytes);
    const offset = local.length;
    local.u32(LOCAL_SIG);
    local.u16(20); // version needed to extract
    local.u16(UTF8_FLAG);
    local.u16(0); // compression: store
    local.u16(time);
    local.u16(dosDate);
    local.u32(crc);
    local.u32(dataBytes.length);
    local.u32(dataBytes.length);
    local.u16(nameBytes.length);
    local.u16(0); // extra field length
    local.bytes(nameBytes);
    local.bytes(dataBytes);
    central.push({ nameBytes, crc, size: dataBytes.length, offset });
  }

  const cd = new ByteWriter();
  for (const c of central) {
    cd.u32(CENTRAL_SIG);
    cd.u16(20); // version made by
    cd.u16(20); // version needed to extract
    cd.u16(UTF8_FLAG);
    cd.u16(0);
    cd.u16(time);
    cd.u16(dosDate);
    cd.u32(c.crc);
    cd.u32(c.size);
    cd.u32(c.size);
    cd.u16(c.nameBytes.length);
    cd.u16(0); // extra field length
    cd.u16(0); // comment length
    cd.u16(0); // disk number start
    cd.u16(0); // internal attrs
    cd.u32(0); // external attrs
    cd.u32(c.offset);
    cd.bytes(c.nameBytes);
  }

  const localBytes = local.toUint8Array();
  const cdBytes = cd.toUint8Array();
  const end = new ByteWriter();
  end.u32(EOCD_SIG);
  end.u16(0);
  end.u16(0);
  end.u16(files.length);
  end.u16(files.length);
  end.u32(cdBytes.length);
  end.u32(localBytes.length);
  end.u16(0); // comment length

  return new Blob([localBytes, cdBytes, end.toUint8Array()] as BlobPart[], { type: 'application/zip' });
}

/** Reads a STORE-only ZIP built by `zipFiles` (or anything else that never compresses). */
export function readZip(buf: ArrayBuffer): { name: string; data: Uint8Array }[] {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const searchFrom = Math.max(0, bytes.length - 22 - 65557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= searchFrom; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const total = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder('utf-8');
  const entries: { name: string; data: Uint8Array }[] = [];
  let p = centralOffset;
  for (let i = 0; i < total; i++) {
    if (view.getUint32(p, true) !== CENTRAL_SIG) throw new Error('Corrupt zip central directory');
    const compression = view.getUint16(p + 10, true);
    if (compression !== 0) throw new Error('Only STORE-compressed zips are supported');
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const data = bytes.slice(dataStart, dataStart + compSize);
    entries.push({ name, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
