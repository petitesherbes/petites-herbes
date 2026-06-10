// Script de migration 009 : insère les 107 produits via l'API Supabase
// Contourne le besoin de DDL en insérant sans la colonne description

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://gnkaccwrphysykjxlgjr.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdua2FjY3dycGh5c3lranhsZ2pyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDkzNzY1OCwiZXhwIjoyMDk2NTEzNjU4fQ.Pa4kjUpGrBPrYhVlii8ETttFS9ku5Ok3wPoezvSX3eU'

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── Parser les produits depuis le SQL ───────────────────────
const sql = readFileSync(join(__dirname, '../supabase/migrations/009_referencement_propre.sql'), 'utf8')

// On extrait chaque ligne VALUES ('ref','desig','desc','cat',prix,tva,'unite',bio,actif)
// Format: ('T001', 'Tapis X', 'description longue...', 'TAPIS', 18.00, 5.5, 'tapis', true, true)
const rowRegex = /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.|'')*?)'\s*,\s*'([^']+)'\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*'([^']+)'\s*,\s*(true|false)\s*,\s*(true|false)\s*\)/g

const produits = []
let m
while ((m = rowRegex.exec(sql)) !== null) {
  produits.push({
    reference:   m[1],
    designation: m[2].replace(/'{2}/g, "'"),
    description: m[3].replace(/'{2}/g, "'"),
    categorie:   m[4],
    prix_ht:     parseFloat(m[5]),
    tva_pct:     parseFloat(m[6]),
    unite:       m[7],
    bio:         m[8] === 'true',
    actif:       m[9] === 'true',
  })
}

console.log(`✅ ${produits.length} produits parsés`)

// ─── Vérifier la colonne description ─────────────────────────
const { data: testRow } = await sb.from('produits').select('*').limit(1)
const colonnes = testRow?.[0] ? Object.keys(testRow[0]) : []
const hasDescription = colonnes.includes('description')
console.log('Colonnes existantes:', colonnes.join(', '))
console.log('Colonne description:', hasDescription ? '✅ existe' : '❌ manquante')

// ─── Supprimer les produits existants ─────────────────────────
console.log('\nSuppression des produits existants...')
const { error: delErr } = await sb.from('produits').delete().neq('id', '00000000-0000-0000-0000-000000000000')
if (delErr) {
  console.error('Erreur suppression:', delErr.message)
  process.exit(1)
}
console.log('✅ Produits supprimés')

// ─── Insérer les nouveaux produits ───────────────────────────
console.log('\nInsertion des 107 produits...')
const produitsAInserer = produits.map(p => {
  const row = {
    reference:   p.reference,
    designation: p.designation,
    categorie:   p.categorie,
    prix_ht:     p.prix_ht,
    tva_pct:     p.tva_pct,
    unite:       p.unite,
    bio:         p.bio,
    actif:       p.actif,
  }
  if (hasDescription) row.description = p.description
  return row
})

// Insérer par lots de 50
for (let i = 0; i < produitsAInserer.length; i += 50) {
  const lot = produitsAInserer.slice(i, i + 50)
  const { error } = await sb.from('produits').insert(lot)
  if (error) {
    console.error(`Erreur lot ${i}-${i+50}:`, error.message)
    process.exit(1)
  }
  console.log(`  Lot ${i+1}-${Math.min(i+50, produitsAInserer.length)} inséré`)
}

console.log(`\n✅ Migration 009 terminée — ${produitsAInserer.length} produits insérés`)
if (!hasDescription) {
  console.log('\n⚠️  ATTENTION : la colonne "description" n\'existe pas encore.')
  console.log('   Pour ajouter les descriptions, exécutez dans Supabase SQL Editor :')
  console.log('   ALTER TABLE produits ADD COLUMN description text;')
  console.log('   Puis relancez ce script pour mettre à jour les descriptions.')
}
