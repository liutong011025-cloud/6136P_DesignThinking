import { z } from "zod";
export const WORK_CHUNK_SIZE = 2_000_000;
export const MAX_WORK_FILE_SIZE = 20_000_000;
export const MAX_WORK_FILES = 5;
export const MAX_WORK_LINKS = 5;
export const WORK_KINDS = ["ppt", "prototype", "tool", "other"] as const;
export type WorkKind = typeof WORK_KINDS[number];
export const WORK_KIND_LABELS: Record<WorkKind, string> = { ppt: "展示PPT", prototype: "报告原型", tool: "分析的工具／网站", other: "其他作品" };
const MIME_BY_EXTENSION: Record<string, string> = {
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp"
};
export function workFileExtension(filename: string) { return filename.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase() ?? ""; }
export function canonicalWorkFilename(value: string) {
  return value.normalize("NFKC").trim().replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/:*?"<>|]/g, "_").replace(/[. ]+$/, "");
}
export function workChunkCount(size: number) { return Math.ceil(size / WORK_CHUNK_SIZE); }
export function expectedWorkChunkSize(size: number, index: number) { return Math.min(WORK_CHUNK_SIZE, size - index * WORK_CHUNK_SIZE); }
export const workLinkSchema = z.object({
  url: z.string().trim().max(2000).refine(value => { try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } }, "作品链接必须是完整的 HTTP 或 HTTPS 地址。"),
  label: z.string().trim().max(150).default("")
}).strict();
export const workFileSchema = z.object({
  filename: z.string().min(1).max(150).transform(canonicalWorkFilename).refine(value => value.length > 0 && !!MIME_BY_EXTENSION[workFileExtension(value)], "请使用 ppt、pptx、pdf、doc、docx、jpg、png 或 webp 文件。"),
  size: z.number().int("文件大小须为整数。").min(1, "不能上传空文件。").max(MAX_WORK_FILE_SIZE, "每个作品文件最多 20 MB。"),
  // Browser MIME hints are ignored. Canonical MIME comes from a supported extension.
  mime: z.string().max(200).optional()
}).strict().transform(file => ({ filename: file.filename, size: file.size, mime: MIME_BY_EXTENSION[workFileExtension(file.filename)], chunkCount: workChunkCount(file.size) }));
export const createWorkSchema = z.object({
  title: z.string().trim().min(1, "请填写作品标题。").max(200, "作品标题最多 200 字。"),
  kind: z.enum(WORK_KINDS), description: z.string().trim().max(5000).default(""),
  links: z.array(workLinkSchema).max(MAX_WORK_LINKS, "每次提交最多添加 5 个链接。").default([]),
  files: z.array(workFileSchema).max(MAX_WORK_FILES, "每次提交最多上传 5 个文件。").default([]),
  requestId: z.string().trim().min(8).max(100).optional()
}).strict().refine(value => value.files.length > 0 || value.links.length > 0, "请至少添加一个作品文件或链接。");

function starts(bytes: Uint8Array, signature: number[], offset = 0) { return bytes.length >= offset + signature.length && signature.every((value, i) => bytes[offset + i] === value); }
function hasOfficePackage(bytes: Uint8Array, requiredDocument: string) {
  if (!starts(bytes, [0x50, 0x4b, 0x03, 0x04]) || bytes.length < 22) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) return false;
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true);
  if (count === 0 || count === 65535 || offset + size > end) return false;
  const names = new Set<string>(); let cursor = offset;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) return false;
    const nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > offset + size) return false;
    names.add(new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)));
    cursor = next;
  }
  return cursor === offset + size && names.has("[Content_Types].xml") && names.has(requiredDocument);
}
/** Basic format identification, without executing, extracting or rendering uploaded content. */
export function validateWorkFileMagic(filename: string, bytes: Uint8Array) {
  const extension = workFileExtension(filename);
  let valid = false;
  switch (extension) {
    case "pdf": valid = starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]); break;
    case "jpg": case "jpeg": valid = starts(bytes, [0xff, 0xd8, 0xff]); break;
    case "png": valid = starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); break;
    case "webp": valid = starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8); break;
    case "ppt": case "doc": valid = starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); break;
    case "pptx": valid = hasOfficePackage(bytes, "ppt/presentation.xml"); break;
    case "docx": valid = hasOfficePackage(bytes, "word/document.xml"); break;
  }
  return valid ? null : "文件内容与扩展名不一致，或文件格式不完整。请检查后重新上传标准、未加密的文件。";
}
