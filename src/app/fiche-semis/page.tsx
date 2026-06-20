'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espece } from '@/types'

type Col = { key: keyof Espece; label: string; unit?: string; defaultOn: boolean }

const TOUTES_COLS: Col[] = [
  { key: 'g_tapis',         label: 'g/tapis',         unit: 'g',      defaultOn: true  },
  { key: 'g_godet',         label: 'g/godet',          unit: 'g',      defaultOn: true  },
  { key: 'g_caisse',        label: 'g/caisse',         unit: 'g',      defaultOn: true  },
  { key: 'g_serie_tapis',   label: 'g/série tapis',    unit: 'g',      defaultOn: true  },
  { key: 'g_serie_caisse',  label: 'g/série caisse',   unit: 'g',      defaultOn: true  },
  { key: 'jours_noir',      label: 'J. Noir',          unit: 'j',      defaultOn: true  },
  { key: 'jours_pousse',    label: 'J. Pousse',        unit: 'j',      defaultOn: true  },
  { key: 'jours_conserv',   label: 'J. Conserv.',      unit: 'j',      defaultOn: true  },
  { key: 'rendement',       label: 'Rendement',        unit: 'g/tapis',defaultOn: false },
  { key: 'prix_graine_kg',  label: 'Prix graine',      unit: '€/kg',   defaultOn: false },
  { key: 'pct_perte',       label: '% perte',          unit: '%',      defaultOn: false },
  { key: 'stock_actuel_g',  label: 'Stock graine',     unit: 'g',      defaultOn: false },
]

const STORAGE_KEY = 'fiche_semis_cols'

function initCols(): string[] {
  if (typeof window === 'undefined') return TOUTES_COLS.filter(c => c.defaultOn).map(c => String(c.key))
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as string[]
  } catch { /* */ }
  return TOUTES_COLS.filter(c => c.defaultOn).map(c => String(c.key))
}

export default function FicheSemisPage() {
  const [especes, setEspeces]     = useState<Espece[]>([])
  const [loading, setLoading]     = useState(true)
  const [editCell, setEditCell]   = useState<{ id: string; key: keyof Espece } | null>(null)
  const [editVal, setEditVal]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [colsActives, setColsActives] = useState<string[]>(initCols)
  const [showSection, setShowSection] = useState(true)
  const [configOpen, setConfigOpen]   = useState(false)

  async function charger() {
    const { data } = await supabase.from('especes').select('*').eq('actif', true).order('nom')
    setEspeces((data ?? []) as Espece[])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  function toggleCol(key: string) {
    setColsActives(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function ouvrirEdit(id: string, key: keyof Espece, val: number | null) {
    setEditCell({ id, key })
    setEditVal(val !== null && val !== undefined ? String(val) : '')
  }

  async function sauvegarder() {
    if (!editCell) return
    setSaving(true)
    const num = editVal.trim() === '' ? null : parseFloat(editVal.replace(',', '.'))
    await supabase.from('especes').update({ [editCell.key]: num }).eq('id', editCell.id)
    setEditCell(null)
    setSaving(false)
    await charger()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') sauvegarder()
    if (e.key === 'Escape') setEditCell(null)
  }

  function fmt(v: number | null | undefined) {
    if (v === null || v === undefined) return null
    return String(v)
  }

  const colsVisibles = TOUTES_COLS.filter(c => colsActives.includes(String(c.key)))

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header (masqué à l'impression) ─────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-bold text-gray-900">Fiche semis</div>
            <div className="text-xs text-gray-400">Cliquer sur une cellule pour la modifier</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setConfigOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors
                ${configOpen ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>
              ⚙️ Colonnes
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-transform">
              🖨️ Imprimer
            </button>
          </div>
        </div>

        {/* ── Panneau de configuration des colonnes ──────────────────── */}
        {configOpen && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">Colonnes visibles</div>
            <div className="flex flex-wrap gap-2">
              {/* Colonne Section (fixe côté code mais toggleable) */}
              <button onClick={() => setShowSection(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                  ${showSection ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-400 border-gray-200 line-through'}`}>
                {showSection ? '✓' : '○'} Section
              </button>
              {TOUTES_COLS.map(c => {
                const on = colsActives.includes(String(c.key))
                return (
                  <button key={String(c.key)} onClick={() => toggleCol(String(c.key))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                      ${on ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-400 border-gray-200 line-through'}`}>
                    {on ? '✓' : '○'} {c.label}{c.unit ? ` (${c.unit})` : ''}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => {
                const all = TOUTES_COLS.map(c => String(c.key))
                setColsActives(all)
                localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
              }} className="text-xs text-green-700 underline">Tout cocher</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => {
                setColsActives([])
                localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
              }} className="text-xs text-red-500 underline">Tout décocher</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Titre à l'impression ────────────────────────────────────────── */}
      <div className="hidden print:block text-center py-3 pb-1">
        <div className="text-lg font-bold">Fiche semis — Les Petites Herbes</div>
        <div className="text-[9pt] text-gray-500">{new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Chargement…</div>
      ) : (
        <div className="overflow-x-auto px-2 py-4 print:px-0 print:py-0">
          <table className="w-full text-xs border-collapse print:text-[8.5pt]">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-left px-3 py-2.5 sticky left-0 bg-gray-800 z-10 min-w-[130px]">
                  Espèce
                </th>
                {showSection && (
                  <th className="px-3 py-2.5 text-center min-w-[70px]">Section</th>
                )}
                {colsVisibles.map(c => (
                  <th key={String(c.key)} className="px-3 py-2.5 text-center whitespace-nowrap min-w-[75px]">
                    {c.label}
                    {c.unit && <div className="text-[8px] font-normal text-gray-300 leading-tight">{c.unit}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {especes.map((e, idx) => (
                <tr key={e.id}
                  className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className={`px-3 py-2 font-semibold text-gray-800 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    {e.nom}
                  </td>
                  {showSection && (
                    <td className="px-3 py-2 text-center text-gray-500 capitalize text-[10px]">
                      {e.section ?? '—'}
                    </td>
                  )}
                  {colsVisibles.map(c => {
                    const val = e[c.key] as number | null
                    const isEditing = editCell?.id === e.id && editCell?.key === c.key
                    const display = fmt(val)
                    return (
                      <td key={String(c.key)} className="px-1 py-1 text-center text-gray-700">
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editVal}
                            onChange={ev => setEditVal(ev.target.value)}
                            onBlur={sauvegarder}
                            onKeyDown={handleKey}
                            disabled={saving}
                            className="w-16 text-center text-xs border border-green-400 rounded px-1 py-0.5 focus:outline-none bg-green-50"
                          />
                        ) : (
                          <button
                            onClick={() => ouvrirEdit(e.id, c.key, val)}
                            className={`w-full min-h-[28px] rounded px-1 py-0.5 print:pointer-events-none transition-colors
                              ${display !== null
                                ? 'text-gray-800 font-medium hover:bg-green-50 hover:text-green-700'
                                : 'text-gray-200 hover:bg-gray-50 hover:text-gray-400'}`}>
                            {display ?? <span className="text-[9px]">—</span>}
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {especes.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-400">Aucune espèce active</div>
          )}
        </div>
      )}

      <style jsx global>{`
        @media print {
          body { background: white; }
          nav, header, .print\\:hidden { display: none !important; }
          table { font-size: 8.5pt; border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #d1d5db; padding: 4px 6px; }
          th { background: #1f2937!important; color: white!important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr:nth-child(even) td { background: #f9fafb!important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>
    </div>
  )
}
