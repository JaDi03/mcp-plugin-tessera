import fs from "node:fs";
import path from "node:path";

const srcDir = path.resolve("src/admin/public");
const destDir = path.resolve("dist/admin/public");

if (fs.existsSync(srcDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(srcDir, destDir, { recursive: true });
  console.log("Assets copied to dist/admin/public");
}
