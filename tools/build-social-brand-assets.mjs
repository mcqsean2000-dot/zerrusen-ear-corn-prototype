import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "assets");
const outputDir = path.join(assets, "social");
const coverWidth = 1640;
const coverHeight = 624;
const panelWidth = 660;

const sourcePhoto = path.join(assets, "theos-both-bags.jpg");
const primaryLogo = path.join(assets, "brand", "theos-farm-primary-logo-concept.png");
const badgeLogo = path.join(assets, "brand", "theos-farm-badge-logo.png");
const parchment = path.join(assets, "brand", "theos-farm-parchment-texture.png");

const background = await sharp(parchment)
  .resize(coverWidth, coverHeight, { fit: "cover" })
  .modulate({ saturation: 0.82, brightness: 1.02 })
  .toBuffer();

const photo = await sharp(sourcePhoto)
  .resize(980, coverHeight, { fit: "cover", position: "center" })
  .toBuffer();

const logo = await sharp(primaryLogo)
  .trim({ background: "#f1dfc0", threshold: 12 })
  .resize({ width: 525, height: 540, fit: "inside", withoutEnlargement: true })
  .toBuffer();

const logoMeta = await sharp(logo).metadata();
const logoLeft = Math.round((panelWidth - logoMeta.width) / 2);
const logoTop = Math.max(18, Math.round((coverHeight - logoMeta.height) / 2) - 9);

const overlay = Buffer.from(`
  <svg width="${coverWidth}" height="${coverHeight}" viewBox="0 0 ${coverWidth} ${coverHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${panelWidth}" height="${coverHeight}" fill="#F1DFC0" fill-opacity=".16"/>
    <rect x="${panelWidth - 5}" width="10" height="${coverHeight}" fill="#30451F"/>
    <rect x="31" y="22" width="${panelWidth - 67}" height="${coverHeight - 44}" rx="10" fill="none" stroke="#CF9418" stroke-width="3"/>
    <rect x="${panelWidth}" y="${coverHeight - 75}" width="${coverWidth - panelWidth}" height="75" fill="#30451F" fill-opacity=".92"/>
    <text x="${panelWidth + 36}" y="${coverHeight - 29}" font-family="Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="2" fill="#FBF5E9">REAL WHOLE EARS • 20 LB &amp; 40 LB BAGS • THEOSFARM.COM</text>
  </svg>
`);

await sharp(background)
  .composite([
    { input: photo, left: panelWidth, top: 0 },
    { input: overlay, left: 0, top: 0 },
    { input: logo, left: logoLeft, top: logoTop },
  ])
  .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
  .toFile(path.join(outputDir, "theos-farm-facebook-cover-real-product.jpg"));

await sharp(badgeLogo)
  .resize(1080, 1080, { fit: "cover" })
  .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
  .toFile(path.join(outputDir, "theos-farm-social-profile-badge.jpg"));

console.log("Built Facebook cover and shared Facebook/Instagram profile badge.");
