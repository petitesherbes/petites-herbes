import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sb = createClient(
  'https://gnkaccwrphysykjxlgjr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdua2FjY3dycGh5c3lranhsZ2pyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDkzNzY1OCwiZXhwIjoyMDk2NTEzNjU4fQ.Pa4kjUpGrBPrYhVlii8ETttFS9ku5Ok3wPoezvSX3eU'
)

const sql = readFileSync(join(__dirname, 'add-descriptions.sql'), 'utf8')
const updates = sql.split('\n').filter(l => l.startsWith('UPDATE'))
console.log(`${updates.length} descriptions à appliquer...`)

let ok = 0, err = 0
for (const upd of updates) {
  const m = upd.match(/SET description = '([\s\S]*?)' WHERE reference = '([A-Z0-9]+)'/)
  if (!m) { err++; continue }
  const [, rawDesc, ref] = m
  const desc = rawDesc.replace(/''/g, "'")
  const { error } = await sb.from('produits').update({ description: desc }).eq('reference', ref)
  if (error) { console.error('❌', ref, error.message); err++ } else { ok++; process.stdout.write('.') }
}
console.log(`\n✅ ${ok} descriptions mises à jour, ${err} erreurs`)
