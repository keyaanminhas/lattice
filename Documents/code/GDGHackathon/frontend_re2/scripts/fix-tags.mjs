import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== "node_modules") walk(p);
    else if (ent.isFile() && /\.(tsx|ts|jsx|js)$/.test(ent.name)) files.push(p);
  }
}
walk(path.join(root, "src"));

for (const file of files) {
  let t = fs.readFileSync(file, "utf8");
  const next = t.replaceAll("motionless", "div");
  if (next !== t) {
    fs.writeFileSync(file, next);
    console.log("fixed", file);
  }
}
