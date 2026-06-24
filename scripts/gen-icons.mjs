import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const pub   = join(__dir, '../public')

// SVG sans emoji — feuille stylisée vectorielle
function makeSvg(size) {
  const r  = Math.round(size * 0.156) // border-radius ~80/512 * size
  const cx = size / 2
  const cy = size / 2
  const s  = size / 512

  // Feuille simple : deux courbes de Bézier formant une feuille
  const leaf = `
    M ${cx} ${cy - 160*s}
    C ${cx + 120*s} ${cy - 120*s}, ${cx + 160*s} ${cy + 40*s}, ${cx} ${cy + 140*s}
    C ${cx - 160*s} ${cy + 40*s}, ${cx - 120*s} ${cy - 120*s}, ${cx} ${cy - 160*s}
    Z
  `
  // Nervure centrale
  const vein = `M ${cx} ${cy - 140*s} L ${cx} ${cy + 130*s}`
  // Nervures latérales
  const vl1  = `M ${cx} ${cy - 60*s}  Q ${cx + 70*s} ${cy - 30*s} ${cx + 100*s} ${cy - 10*s}`
  const vl2  = `M ${cx} ${cy + 10*s}  Q ${cx + 80*s} ${cy + 40*s} ${cx + 80*s}  ${cy + 70*s}`
  const vr1  = `M ${cx} ${cy - 60*s}  Q ${cx - 70*s} ${cy - 30*s} ${cx - 100*s} ${cy - 10*s}`
  const vr2  = `M ${cx} ${cy + 10*s}  Q ${cx - 80*s} ${cy + 40*s} ${cx - 80*s}  ${cy + 70*s}`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#1B5E20"/>
  <path d="${leaf}" fill="#4CAF50"/>
  <path d="${vein}" stroke="#1B5E20" stroke-width="${4*s}" fill="none" stroke-linecap="round"/>
  <path d="${vl1}" stroke="#1B5E20" stroke-width="${2.5*s}" fill="none" stroke-linecap="round"/>
  <path d="${vl2}" stroke="#1B5E20" stroke-width="${2.5*s}" fill="none" stroke-linecap="round"/>
  <path d="${vr1}" stroke="#1B5E20" stroke-width="${2.5*s}" fill="none" stroke-linecap="round"/>
  <path d="${vr2}" stroke="#1B5E20" stroke-width="${2.5*s}" fill="none" stroke-linecap="round"/>
</svg>`
}

async function generate(sizePx, filename) {
  const svg = Buffer.from(makeSvg(sizePx))
  await sharp(svg).png().toFile(join(pub, filename))
  console.log(`✅ ${filename} (${sizePx}px)`)
}

await generate(180, 'apple-touch-icon.png')
await generate(192, 'icon-192.png')
await generate(512, 'icon-512.png')
console.log('Icônes générées.')
