import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = path.join(rootDir, "package.json");
const manifestPath = path.join(rootDir, "src", "manifest.json");

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

assertManifestCompatibleVersion(packageJson.version);

if (manifest.version === packageJson.version) {
  console.log(`manifest version already synced: ${packageJson.version}`);
  process.exit(0);
}

manifest.version = packageJson.version;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`manifest version synced to ${packageJson.version}`);

function assertManifestCompatibleVersion(version) {
  const parts = version.split(".");

  if (parts.length < 1 || parts.length > 4) {
    throw new Error(
      `package.json version "${version}" is not valid for a browser extension manifest.`,
    );
  }

  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,4})$/.test(part)) {
      throw new Error(
        `package.json version "${version}" must contain 1 to 4 numeric segments for the manifest.`,
      );
    }

    if (Number(part) > 65535) {
      throw new Error(
        `package.json version "${version}" contains "${part}", which exceeds the manifest limit of 65535.`,
      );
    }
  }
}
