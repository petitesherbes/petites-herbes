import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, '../supabase/migrations/009_referencement_propre.sql'), 'utf8')

// Parser référence + description
const rowRegex = /\('([A-Z]\d{3,4})',\s*'([^']+)',\s*'([\s\S]*?)(?<!')',\s*'[A-Z]/g

const produits = []
let m
while ((m = rowRegex.exec(sql)) !== null) {
  produits.push({ ref: m[1], desc: m[3] })
}

console.log(`Parsé ${produits.length} descriptions`)
if (produits.length > 0) {
  console.log('Exemple:', produits[0].ref, '->', produits[0].desc.substring(0, 60))
}

// Générer le SQL
const lines = [
  '-- Ajout colonne description + remplissage',
  'ALTER TABLE produits ADD COLUMN IF NOT EXISTS description text;',
  '',
]
for (const p of produits) {
  const safe = p.desc.replace(/'/g, "''")
  lines.push(`UPDATE produits SET description = '${safe}' WHERE reference = '${p.ref}';`)
}
writeFileSync(join(__dirname, 'add-descriptions.sql'), lines.join('\n'), 'utf8')
console.log(`✅ ${lines.length} lignes SQL générées → scripts/add-descriptions.sql`)
