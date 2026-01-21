import { promises as fs } from "fs";
import path from "path";

const baseDir = path.join(process.cwd(), "generated");

export async function saveBuffer(key: string, buffer: Buffer): Promise<string> {
  const target = path.join(baseDir, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return key;
}

export async function readBuffer(key: string): Promise<Buffer> {
  const target = path.join(baseDir, key);
  return fs.readFile(target);
}
