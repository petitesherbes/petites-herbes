'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espece } from '@/types'

type Col = {
  key: string
  label: string
  unit?: string
  defaultOn: boolean
  value: (e: Espece, nbSerie: number) => number | null
  calc?: boolean
}

const COLS: Col[] = [
  { key: 'g_tapis',       label: 'g/tapis',        unit: 'g',       defaultOn: true,  value: e => e.g_tapis },
  { key: 'g_godet',       label: 'g/godet',         unit: 'g',       defaultOn: true,  value: e => e.g_godet },
  { key: 'g_caisse',      label: 'g/caisse',        unit: 'g',       defaultOn: true,  value: e => e.g_caisse },
  { key: 'g_serie_tapis', label: 'g/série tapis',   unit: 'g',       defaultOn: true,  value: (e, nb) => e.g_tapis !== null ? Math.round(e.g_tapis * nb) : null, calc: true },
  { key: 'jours_noir',    label: 'J. Noir',         unit: 'j',       defaultOn: true,  value: e => e.jours_noir },
  { key: 'jours_pousse',  label: 'J. Pousse',       unit: 'j',       defaultOn: true,  value: e => e.jours_pousse },
  { key: 'jours_conserv', label: 'J. Conserv.',     unit: 'j',       defaultOn: false, value: e => e.jours_conserv },
  { key: 'rendement',     label: 'Rendement',       unit: 'g/tapis', defaultOn: false, value: e => e.rendement },
  { key: 'prix_graine_kg',label: 'Prix graine',     unit: '€/kg',    defaultOn: false, value: e => e.prix_graine_kg },
]

const STORAGE_KEY = 'fiche_semis_cols'

function initCols(): string[] {
  if (typeof window === 'undefined') return COLS.filter(c => c.defaultOn).map(c => c.key)
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s) } catch { /* */ }
  return COLS.filter(c => c.defaultOn).map(c => c.key)
}

export default function FicheSemisPage() {
  const [especes, setEspeces]         = useState<Espece[]>([])
  const [loading, setLoading]         = useState(true)
  const [nbSerie, setNbSerie]         = useState(26)
  const [editNb, setEditNb]           = useState(false)
  const [nbVal, setNbVal]             = useState('26')
  const [savingNb, setSavingNb]       = useState(false)
  const [paramsId, setParamsId]       = useState<string | null>(null)
  const [colsActives, setColsActives] = useState<string[]>(initCols)
  const [showSection, setShowSection] = useState(false)
  const [configOpen, setConfigOpen]   = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('especes').select('*').eq('actif', true).order('nom'),
      supabase.from('parametres_production').select('id, nb_tapis_serie').single(),
    ]).then(([{ data: esp }, { data: params }]) => {
      setEspeces((esp ?? []) as Espece[])
      if (params) {
        setParamsId(params.id as string)
        const nb = (params as { nb_tapis_serie: number | null }).nb_tapis_serie ?? 26
        setNbSerie(nb); setNbVal(String(nb))
      }
      setLoading(false)
    })
  }, [])

  async function sauvegarderNb() {
    if (!paramsId) return
    setSavingNb(true)
    const nb = Math.max(1, parseInt(nbVal) || 26)
    await supabase.from('parametres_production').update({ nb_tapis_serie: nb }).eq('id', paramsId)
    setNbSerie(nb); setEditNb(false); setSavingNb(false)
  }

  function toggleCol(key: string) {
    setColsActives(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const visibles = COLS.filter(c => colsActives.includes(c.key))

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header (masqué à l'impression) ───────────────────────────── */}
      <div className="print:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-base font-bold text-gray-900">Fiche semis</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setConfigOpen(o => !o)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors
                ${configOpen ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>
              ⚙️ Colonnes
            </button>
            <button onClick={() => window.print()}
              className="bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-transform">
              🖨️ Imprimer
            </button>
          </div>
        </div>

        {/* Paramètre série */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Tapis/série :</span>
          {editNb ? (
            <>
              <input autoFocus type="number" value={nbVal} onChange={e => setNbVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sauvegarderNb(); if (e.key === 'Escape') setEditNb(false) }}
                className="w-14 text-center border border-green-400 rounded-lg px-2 py-0.5 focus:outline-none bg-green-50 text-sm" />
              <button onClick={sauvegarderNb} disabled={savingNb}
                className="bg-green-700 text-white px-2.5 py-0.5 rounded-lg disabled:opacity-40">
                {savingNb ? '…' : 'OK'}
              </button>
              <button onClick={() => setEditNb(false)} className="text-gray-400">Annuler</button>
            </>
          ) : (
            <button onClick={() => { setEditNb(true); setNbVal(String(nbSerie)) }}
              className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200 hover:bg-blue-100 transition-colors">
              {nbSerie} tapis ✏️
            </button>
          )}
          <span className="text-gray-400">→ g/série = g/tapis × {nbSerie}</span>
        </div>

        {/* Sélecteur colonnes */}
        {configOpen && (
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setShowSection(s => !s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                  ${showSection ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-400 border-gray-200 line-through'}`}>
                {showSection ? '✓' : '○'} Section
              </button>
              {COLS.map(c => {
                const on = colsActives.includes(c.key)
                return (
                  <button key={c.key} onClick={() => toggleCol(c.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                      ${on
                        ? c.calc ? 'bg-blue-600 text-white border-blue-600' : 'bg-green-700 text-white border-green-700'
                        : 'bg-white text-gray-400 border-gray-200 line-through'}`}>
                    {on ? '✓' : '○'} {c.label}{c.calc ? ' (auto)' : ''}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3 text-xs">
              <button onClick={() => { const all = COLS.map(c => c.key); setColsActives(all); localStorage.setItem(STORAGE_KEY, JSON.stringify(all)) }}
                className="text-green-700 underline">Tout afficher</button>
              <button onClick={() => { setColsActives([]); localStorage.setItem(STORAGE_KEY, JSON.stringify([])) }}
                className="text-red-500 underline">Tout masquer</button>
            </div>
          </div>
        )}
      </div>

      {/* ── En-tête impression ──────────────────────────────────────────── */}
      <div className="hidden print:block text-center py-3">
        <div className="text-lg font-bold">Fiche semis — Les Petites Herbes</div>
        <div className="text-[8pt] text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          {visibles.some(c => c.calc) ? ` · g/série tapis = g/tapis × ${nbSerie}` : ''}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Chargement…</div>
      ) : (
        <div className="overflow-x-auto px-2 py-4 print:p-0">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-left px-3 py-2.5 sticky left-0 bg-gray-800 min-w-[130px]">Espèce</th>
                {showSection && <th className="px-3 py-2.5 text-center min-w-[70px]">Section</th>}
                {visibles.map(c => (
                  <th key={c.key} className={`px-3 py-2.5 text-center whitespace-nowrap min-w-[70px] ${c.calc ? 'text-blue-200' : ''}`}>
                    {c.label}
                    {c.unit && <div className="text-[8px] font-normal opacity-50 leading-tight">{c.unit}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {especes.map((e, i) => (
                <tr key={e.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className={`px-3 py-2.5 font-semibold text-gray-800 sticky left-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    {e.nom}
                  </td>
                  {showSection && (
                    <td className="px-3 py-2.5 text-center text-gray-400 text-[10px] capitalize">{e.section ?? ''}</td>
                  )}
                  {visibles.map(c => {
                    const val = c.value(e, nbSerie)
                    return (
                      <td key={c.key} className={`px-3 py-2.5 text-center ${c.calc ? 'text-blue-700 font-semibold' : 'text-gray-700'}`}>
                        {val !== null ? val : <span className="text-gray-200">—</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body { background: white; }
          nav, .print\\:hidden { display: none !important; }
          table { font-size: 9pt; border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #e5e7eb; padding: 4px 8px; }
          th { background: #1f2937!important; color: white!important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr:nth-child(even) td { background: #f9fafb!important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>
    </div>
  )
}
