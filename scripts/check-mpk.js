// Fails when a release .mpk is missing LICENSE or dependencies.txt.
// Runs as `postrelease`, so every `npm run release` checks it, on Windows too.
// Node only, no dependencies: it reads the zip's central directory itself.
const { readdirSync, readFileSync, existsSync } = require("fs");
const { join } = require("path");

const REQUIRED = ["LICENSE", "dependencies.txt"];
const EOCD_SIGNATURE = 0x06054b50;
const ENTRY_SIGNATURE = 0x02014b50;

function zipEntryNames(buffer) {
    // The end-of-central-directory record is in the last 22 bytes plus an optional comment of up to 64 KiB.
    let eocd = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) {
        if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) {
        throw new Error("not a zip file (no end-of-central-directory record)");
    }
    const count = buffer.readUInt16LE(eocd + 10);
    let offset = buffer.readUInt32LE(eocd + 16);
    const names = [];
    for (let n = 0; n < count; n++) {
        if (buffer.readUInt32LE(offset) !== ENTRY_SIGNATURE) {
            throw new Error(`corrupt central directory at entry ${n}`);
        }
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        names.push(buffer.toString("utf8", offset + 46, offset + 46 + nameLength));
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return names;
}

// Only the folder of the version being released: an .mpk left in another
// dist/<version>/ by an older build must not fail (or pass) this one.
const { version } = require("../package.json");
const releaseDir = join(__dirname, "..", "dist", version);

function releaseMpks() {
    if (!existsSync(releaseDir)) {
        return [];
    }
    return readdirSync(releaseDir)
        .filter(file => file.endsWith(".mpk"))
        .map(file => join(releaseDir, file));
}

const mpks = releaseMpks();
if (mpks.length === 0) {
    console.error(`check-mpk: no .mpk found in ${releaseDir}`);
    process.exit(1);
}

let failed = false;
for (const mpk of mpks) {
    const names = zipEntryNames(readFileSync(mpk));
    const missing = REQUIRED.filter(file => !names.includes(file));
    if (missing.length > 0) {
        failed = true;
        console.error(`check-mpk: ${mpk} is missing ${missing.join(" and ")}`);
    } else {
        console.log(`check-mpk: ${mpk} ships ${REQUIRED.join(" and ")}`);
    }
}
process.exit(failed ? 1 : 0);
