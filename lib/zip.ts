import archiver from "archiver";
import { PassThrough } from "stream";

export async function zipBuffers(
  files: { name: string; buffer: Buffer }[]
): Promise<Buffer> {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  stream.on("data", (chunk) => chunks.push(chunk as Buffer));
  archive.pipe(stream);

  for (const file of files) {
    archive.append(file.buffer, { name: file.name });
  }

  await archive.finalize();

  return new Promise((resolve, reject) => {
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
