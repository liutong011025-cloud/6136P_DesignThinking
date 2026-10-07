import test from "node:test";
import assert from "node:assert/strict";
import { canonicalWorkFilename, createWorkSchema, workFileSchema, validateWorkFileMagic, WORK_CHUNK_SIZE, MAX_WORK_FILE_SIZE, expectedWorkChunkSize } from "../src/lib/work-validation";
const link = { url: "https://example.org/demo", label: "示例链接" };
test("作品独立提交至少一个文件或链接，限制五文件及五链接", () => {
  assert.equal(createWorkSchema.safeParse({ title: "展示", kind: "ppt" }).success, false);
  assert.equal(createWorkSchema.safeParse({ title: "工具分析", kind: "tool", links: [link] }).success, true);
  assert.equal(createWorkSchema.safeParse({ title: "作品", kind: "other", links: Array(6).fill(link) }).success, false);
  assert.equal(createWorkSchema.safeParse({ title: "作品", kind: "other", files: Array(6).fill({ filename: "demo.pdf", size: 10 }) }).success, false);
});
test("作品链接只允许 HTTP(S)，文件类型与大小按服务器规则决定", () => {
  assert.equal(createWorkSchema.safeParse({ title: "工具", kind: "tool", links: [{ url: "javascript:alert(1)" }] }).success, false);
  assert.equal(workFileSchema.safeParse({ filename: "demo.html", size: 10, mime: "application/pdf" }).success, false);
  assert.equal(workFileSchema.safeParse({ filename: "demo.pdf", size: MAX_WORK_FILE_SIZE + 1 }).success, false);
  assert.equal(workFileSchema.safeParse({ filename: "empty.pdf", size: 0 }).success, false);
  assert.equal(workFileSchema.parse({ filename: "Photo.JPEG", size: 10, mime: "text/html" }).mime, "image/jpeg");
});
test("文件名去除路径与控制字符，文件分块使用唯一的十进制常量", () => {
  assert.equal(canonicalWorkFilename("../unsafe\u0000/file.pdf"), ".._unsafe_file.pdf");
  const file = workFileSchema.parse({ filename: "展示.pptx", size: WORK_CHUNK_SIZE + 100 });
  assert.equal(file.chunkCount, 2);
  assert.equal(expectedWorkChunkSize(file.size, 0), 2_000_000); assert.equal(expectedWorkChunkSize(file.size, 1), 100);
  assert.equal(workFileSchema.parse({ filename: "limit.pdf", size: MAX_WORK_FILE_SIZE }).chunkCount, 10);
});
test("改扩展名或浏览器 MIME 不能代替基本文件签名", () => {
  assert.equal(validateWorkFileMagic("real.pdf", new TextEncoder().encode("%PDF-1.7\nexample")), null);
  assert.ok(validateWorkFileMagic("fake.pdf", new TextEncoder().encode("<html>fake</html>")));
  assert.equal(validateWorkFileMagic("photo.jpeg", new Uint8Array([255, 216, 255, 224])), null);
  assert.equal(validateWorkFileMagic("image.png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), null);
  assert.ok(validateWorkFileMagic("demo.pptx", new Uint8Array([80, 75, 3, 4, 0, 0])));
});
function zipWithNames(names: string[]) {
  const local: Buffer[] = [], central: Buffer[] = []; let offset = 0;
  for (const name of names) {
    const filename = Buffer.from(name); const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(filename.length, 26);
    local.push(header, filename);
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    central.push(directory, filename); offset += header.length + filename.length;
  }
  const entries = Buffer.concat(central); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(entries.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, entries, end]);
}
test("PPTX 和 DOCX 包需要对应 Office 路径，普通 ZIP 不能冒充", () => {
  const pptx = zipWithNames(["[Content_Types].xml", "ppt/presentation.xml"]);
  assert.equal(validateWorkFileMagic("presentation.pptx", pptx), null);
  assert.ok(validateWorkFileMagic("presentation.docx", pptx));
  assert.equal(validateWorkFileMagic("document.docx", zipWithNames(["[Content_Types].xml", "word/document.xml"])), null);
  assert.ok(validateWorkFileMagic("archive.pptx", zipWithNames(["readme.txt"])));
  assert.ok(validateWorkFileMagic("truncated.pptx", pptx.subarray(0, pptx.length - 1)));
});
