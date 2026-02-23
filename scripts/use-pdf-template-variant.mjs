import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const templateDir = path.join(rootDir, "public", "pdf-templates");
const variantRoot = path.join(templateDir, "variants");
const availableVariants = ["adventure", "medal-fes", "swim-hero"];

function printUsage() {
  console.log("Usage: node scripts/use-pdf-template-variant.mjs <variant>");
  console.log(`Available variants: ${availableVariants.join(", ")}`);
}

async function activateVariant(variant) {
  if (!availableVariants.includes(variant)) {
    throw new Error(`Unknown variant: ${variant}`);
  }

  const sourceDir = path.join(variantRoot, variant);
  const files = ["record-certificate.png", "first-prize-certificate.png"];

  for (const fileName of files) {
    const source = path.join(sourceDir, fileName);
    const target = path.join(templateDir, fileName);
    await fs.copyFile(source, target);
  }

  console.log(`Activated pdf template variant: ${variant}`);
}

async function main() {
  const variant = process.argv[2];
  if (!variant) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  await activateVariant(variant);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Failed to switch pdf template variant";
  console.error(message);
  process.exitCode = 1;
});
