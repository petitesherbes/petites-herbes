// Script pour générer les icônes PWA
// Crée des PNG simples avec canvas si disponible, sinon indique comment faire

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

// SVG source
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#1B5E20"/>
  <rect x="${size*0.1}" y="${size*0.1}" width="${size*0.8}" height="${size*0.8}" rx="${size*0.1}" fill="#2E7D32"/>
  <text x="${size/2}" y="${size*0.72}" font-size="${size*0.55}" text-anchor="middle" fill="white" font-family="Arial">🌿</text>
</svg>`

// Écrire les SVG (qui marchent aussi comme icônes dans certains contextes)
writeFileSync(join(publicDir, 'icon-192.svg'), svg(192))
writeFileSync(join(publicDir, 'icon-512.svg'), svg(512))

console.log('✅ SVG icons generated in /public/')
console.log('💡 Pour des PNG, utilisez https://svg2png.com ou Inkscape')
console.log('   Convertissez icon-192.svg → icon-192.png')
console.log('   Convertissez icon-512.svg → icon-512.png')
