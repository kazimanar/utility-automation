// SharePoint / OneDrive sürümünü üretir: panel/index.html + tags.js + calc.js + file-store.js
// ve Chart.js / SheetJS kütüphaneleri tek, internetsiz çalışan bir HTML dosyasına gömülür.
// Kullanım: node demin-water-project/sharepoint/build.mjs
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const panel = path.join(here, "..", "panel");
const cache = path.join(here, ".vendor");
const out = path.join(here, "dist", "demin-panel-sharepoint.html");

// Panelin artifact sürümüyle aynı sürümler. Önce cdnjs, olmazsa npm paketinin içinden alınır.
const LIBS = [
  { file: "chart.umd.min.js", urls: ["https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js", "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"], npm: ["chart.js@4.4.1", "package/dist/chart.umd.js"] },
  { file: "xlsx.full.min.js", urls: ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"], npm: ["xlsx@0.18.5", "package/dist/xlsx.full.min.js"] }
];

async function fromNpm([spec, inner], dest) {
  const { execFileSync } = await import("node:child_process");
  const tgz = execFileSync("npm", ["pack", spec, "--silent"], { cwd: cache, encoding: "utf8" }).trim().split("\n").pop();
  execFileSync("tar", ["-xzf", tgz, inner], { cwd: cache });
  execFileSync("mv", [path.join(cache, inner), dest]);
}
async function lib({ file, urls, npm }) {
  const p = path.join(cache, file);
  try { await access(p); } catch {
    await mkdir(cache, { recursive: true });
    let ok = false;
    for (const url of urls) {
      try { const r = await fetch(url); if (r.ok) { await writeFile(p, Buffer.from(await r.arrayBuffer())); ok = true; break; } } catch {}
    }
    if (!ok) await fromNpm(npm, p);
  }
  return readFile(p, "utf8");
}
// Satır içi betikte "</script" kapanışı erken bitirmesin.
const inline = code => "<script>\n" + code.replace(/<\/script/gi, "<\\/script") + "\n</script>";

let html = await readFile(path.join(panel, "index.html"), "utf8");
const [chart, xlsx] = await Promise.all(LIBS.map(lib));
const tags = await readFile(path.join(panel, "tags.js"), "utf8");
const calc = await readFile(path.join(panel, "calc.js"), "utf8");
const store = await readFile(path.join(panel, "file-store.js"), "utf8");

const swap = (from, to) => {
  if (!html.includes(from)) throw new Error("Bulunamadı: " + from);
  html = html.replace(from, () => to);
};
swap('<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>', inline(chart));
swap('<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>', inline(xlsx));
swap('<script src="tags.js"></script>', inline(tags));
swap('<script src="calc.js"></script>', inline(calc) + "\n" + inline(store));

const stamp = new Date().toISOString().slice(0, 10);
const doc = '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
  "<!-- Demin Su Ünitesi paneli · SharePoint/OneDrive sürümü · " + stamp + " · kaynak: demin-water-project/ -->\n" +
  "<style>:root{color-scheme:light}body{margin:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n" +
  "</head>\n<body>\n" + html + "\n</body>\n</html>\n";

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, doc);
console.log("Yazıldı:", path.relative(process.cwd(), out), (doc.length / 1024).toFixed(0) + " KB");
