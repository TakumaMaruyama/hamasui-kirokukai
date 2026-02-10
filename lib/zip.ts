import archiver from "archiver";
import { PassThrough } from "stream";

export async function zipBuffers(
  files: { name: string; buffer: Buffer }[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    let resolved = false;

    const resolveOnce = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(Buffer.concat(chunks));
    };

    stream.on("data", (chunk) => chunks.push(chunk as Buffer));
    stream.on("end", resolveOnce);
    stream.on("close", resolveOnce);
    stream.on("error", reject);
    archive.on("error", reject);

    archive.pipe(stream);

    for (const file of files) {
      archive.append(file.buffer, { name: file.name });
    }

    archive.finalize();
  });
}
