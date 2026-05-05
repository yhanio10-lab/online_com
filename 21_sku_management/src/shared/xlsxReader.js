import { readFile } from "node:fs/promises";
import zlib from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

function readUInt16(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripTags(value) {
  return xmlDecode(String(value || "").replace(/<[^>]+>/g, ""));
}

function findEndOfCentralDirectory(buffer) {
  const start = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= start; offset -= 1) {
    if (readUInt32(buffer, offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("Invalid xlsx zip: end of central directory not found");
}

function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = readUInt16(buffer, eocdOffset + 10);
  const directoryOffset = readUInt32(buffer, eocdOffset + 16);
  const entries = new Map();
  let offset = directoryOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (readUInt32(buffer, offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Invalid xlsx zip: central directory is corrupted");
    }
    const compression = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    entries.set(name, { compression, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function inflateEntry(buffer, entry) {
  if (readUInt32(buffer, entry.localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
    throw new Error("Invalid xlsx zip: local file header is corrupted");
  }
  const fileNameLength = readUInt16(buffer, entry.localHeaderOffset + 26);
  const extraLength = readUInt16(buffer, entry.localHeaderOffset + 28);
  const dataOffset = entry.localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);
  if (entry.compression === 0) return compressed.toString("utf8");
  if (entry.compression === 8) return zlib.inflateRawSync(compressed).toString("utf8");
  throw new Error(`Unsupported xlsx compression method: ${entry.compression}`);
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const strings = [];
  const siMatches = xml.matchAll(/<si\b[\s\S]*?<\/si>/g);
  for (const match of siMatches) {
    const textParts = Array.from(match[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((item) => xmlDecode(item[1]));
    strings.push(textParts.join(""));
  }
  return strings;
}

function columnName(cellRef) {
  return String(cellRef || "").replace(/[0-9]/g, "");
}

function parseCellValue(cellXml, sharedStrings) {
  const type = /<c\b[^>]*\bt="([^"]+)"/.exec(cellXml)?.[1] || "";
  const inline = /<is\b[\s\S]*?<\/is>/.exec(cellXml)?.[0];
  if (inline) return stripTags(inline);
  const raw = /<v>([\s\S]*?)<\/v>/.exec(cellXml)?.[1] || "";
  if (type === "s") return sharedStrings[Number(raw)] || "";
  return xmlDecode(raw);
}

function parseRows(sheetXml, sharedStrings) {
  const rows = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cellMatch of rowMatch[2].matchAll(/<c\b[^>]*\br="([^"]+)"[^>]*>[\s\S]*?<\/c>/g)) {
      cells[columnName(cellMatch[1])] = parseCellValue(cellMatch[0], sharedStrings);
    }
    rows.push({ rowNumber: Number(rowMatch[1]), cells });
  }
  return rows;
}

export async function readFirstSheetRows(filePath) {
  const buffer = await readFile(filePath);
  const entries = readZipEntries(buffer);
  const sharedStrings = parseSharedStrings(entries.has("xl/sharedStrings.xml") ? inflateEntry(buffer, entries.get("xl/sharedStrings.xml")) : "");
  const sheetEntry = entries.get("xl/worksheets/sheet1.xml");
  if (!sheetEntry) throw new Error("First worksheet not found");
  return parseRows(inflateEntry(buffer, sheetEntry), sharedStrings);
}
