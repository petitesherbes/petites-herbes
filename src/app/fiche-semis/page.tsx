'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Espece } from '@/types'
import { loadFormatColors, colFormatKey, type FormatColors } from '@/lib/formatColors'

type Col = {
  key: string
  label: string
  unit?: string
  defaultOn: boolean
  value: (e: Espece, tp: number, gp: number) => number | null
  calc?: boolean
  text?: boolean
}

const COLS: Col[] = [
  { key: 'g_tapis',        label: 'g/tapis',         unit: 'g',       defaultOn: true,  value: e => e.g_tapis },
  { key: 'g_godet',        label: 'g/godet',          unit: 'g',       defaultOn: true,  value: e => e.g_godet },
  { key: 'g_caisse',       label: 'g/caisse',         unit: 'g',       defaultOn: true,  value: e => e.g_caisse },
  { key: 'g_serie_tapis',  label: 'g/série tapis',    unit: 'g',       defaultOn: true,  value: (e, tp) => e.g_tapis !== null ? Math.round(e.g_tapis * tp * 10) / 10 : null, calc: true },
  { key: 'g_serie_godets', label: 'g/série godets',   unit: 'g',       defaultOn: true,  value: (e, _, gp) => e.g_godet !== null ? Math.round(e.g_godet * gp * 10) / 10 : null, calc: true },
  { key: 'jours_noir',     label: 'J. Noir',          unit: 'j',       defaultOn: true,  value: e => e.jours_noir },
  { key: 'jours_pousse',   label: 'J. Pousse',        unit: 'j',       defaultOn: true,  value: e => e.jours_pousse },
  { key: 'jours_conserv',  label: 'J. Conserv.',      unit: 'j',       defaultOn: false, value: e => e.jours_conserv },
  { key: 'rendement',      label: 'Rendement',        unit: 'g/tapis', defaultOn: false, value: e => e.rendement },
  { key: 'prix_graine_kg', label: 'Prix graine',      unit: '€/kg',    defaultOn: false, value: e => e.prix_graine_kg },
  { key: 'notes',          label: 'Notes',             unit: undefined, defaultOn: false, value: () => null, text: true },
]

const STORAGE_KEY = 'fiche_semis_cols'
function initCols(): string[] {
  if (typeof window === 'undefined') return COLS.filter(c => c.defaultOn).map(c => c.key)
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s) } catch { /* */ }
  return COLS.filter(c => c.defaultOn).map(c => c.key)
}

type ParamKey = 'tapis_par_caisse' | 'godets_par_serie'

export default function FicheSemisPage() {
  const [especes, setEspeces]         = useState<Espece[]>([])
  const [loading, setLoading]         = useState(true)
  const [paramsId, setParamsId]       = useState<string | null>(null)
  const [tapisParCaisse, setTapisParCaisse] = useState(26)
  const [godetsParSerie, setGodetsParSerie] = useState(14)
  const [editParam, setEditParam]     = useState<ParamKey | null>(null)
  const [editParamVal, setEditParamVal] = useState('')
  const [savingParam, setSavingParam] = useState(false)
  const [colsActives, setColsActives] = useState<string[]>(initCols)
  const [showSection, setShowSection] = useState(false)
  const [configOpen, setConfigOpen]   = useState(false)
  const [editCell, setEditCell]       = useState<{ id: string; key: keyof Espece } | null>(null)
  const [editVal, setEditVal]         = useState('')
  const [saving, setSaving]           = useState(false)
  const [printOpen, setPrintOpen]     = useState(false)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape')
  const [fontSize, setFontSize]       = useState<'small' | 'normal' | 'large'>('normal')
  const [especesExclues, setEspecesExclues] = useState<Set<string>>(new Set())
  const [fmtColors, setFmtColors] = useState<FormatColors>(loadFormatColors)

  useEffect(() => {
    const handler = () => setFmtColors(loadFormatColors())
    window.addEventListener('format-colors-changed', handler)
    return () => window.removeEventListener('format-colors-changed', handler)
  }, [])

  useEffect(() => {
    Promise.all([
      supabase.from('especes').select('*').eq('actif', true).order('nom'),
      supabase.from('parametres_production').select('id, tapis_par_caisse, godets_par_serie').single(),
    ]).then(([{ data: esp }, { data: p }]) => {
      setEspeces((esp ?? []) as Espece[])
      if (p) {
        setParamsId(p.id as string)
        setTapisParCaisse((p as { tapis_par_caisse: number | null }).tapis_par_caisse ?? 26)
        setGodetsParSerie((p as { godets_par_serie: number | null }).godets_par_serie ?? 14)
      }
      setLoading(false)
    })
  }, [])

  async function sauvegarderParam(key: ParamKey, val: string) {
    if (!paramsId) return
    setSavingParam(true)
    const num = Math.max(1, parseInt(val) || 1)
    await supabase.from('parametres_production').update({ [key]: num }).eq('id', paramsId)
    if (key === 'tapis_par_caisse') setTapisParCaisse(num)
    else setGodetsParSerie(num)
    setEditParam(null)
    setSavingParam(false)
  }

  function toggleCol(key: string) {
    setColsActives(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  async function sauvegarder() {
    if (!editCell) return
    setSaving(true)
    const col = COLS.find(c => c.key === editCell.key)
    const val = col?.text
      ? (editVal.trim() === '' ? null : editVal.trim())
      : (editVal.trim() === '' ? null : parseFloat(editVal.replace(',', '.')))
    await supabase.from('especes').update({ [editCell.key]: val }).eq('id', editCell.id)
    setEspeces(prev => prev.map(e => e.id === editCell.id ? { ...e, [editCell.key]: val } : e))
    setEditCell(null)
    setSaving(false)
  }

  const visibles = COLS.filter(c => colsActives.includes(c.key))

  function ParamBadge({ pk, label, val }: { pk: ParamKey; label: string; val: number }) {
    const isEditing = editParam === pk
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-gray-500">{label} :</span>
        {isEditing ? (
          <>
            <input autoFocus type="number" value={editParamVal}
              onChange={e => setEditParamVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sauvegarderParam(pk, editParamVal); if (e.key === 'Escape') setEditParam(null) }}
              className="w-14 text-center border border-green-400 rounded-lg px-2 py-0.5 focus:outline-none bg-green-50 text-sm" />
            <button onClick={() => sauvegarderParam(pk, editParamVal)} disabled={savingParam}
              className="bg-green-700 text-white px-2 py-0.5 rounded-lg text-xs disabled:opacity-40">
              {savingParam ? '…' : 'OK'}
            </button>
            <button onClick={() => setEditParam(null)} className="text-gray-400 text-xs">✕</button>
          </>
        ) : (
          <button onClick={() => { setEditParam(pk); setEditParamVal(String(val)) }}
            className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200 hover:bg-blue-100 transition-colors">
            {val} ✏️
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-base font-bold text-gray-900">Fiche semis</div>
            <Link href="/parametres" className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg font-semibold hover:bg-green-100 transition-colors">
              + Espèce
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setConfigOpen(o => !o); setPrintOpen(false) }}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors
                ${configOpen ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>
              ⚙️ Colonnes
            </button>
            <button onClick={() => { setPrintOpen(o => !o); setConfigOpen(false) }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-transform
                ${printOpen ? 'bg-green-800 text-white' : 'bg-green-700 text-white'}`}>
              🖨️ Imprimer{especesExclues.size > 0 ? ` (${especes.length - especesExclues.size}/${especes.length})` : ''}
            </button>
          </div>
        </div>

        {/* Paramètres série */}
        <div className="flex flex-wrap gap-4">
          <ParamBadge pk="tapis_par_caisse" label="Tapis/caisse" val={tapisParCaisse} />
          <ParamBadge pk="godets_par_serie" label="Godets/série" val={godetsParSerie} />
        </div>

        {/* ── Panneau impression ───────────────────────────────────────── */}
        {printOpen && (
          <div className="mt-2 pt-3 border-t border-gray-100 space-y-3">
            <div className="flex flex-wrap gap-4">
              <div>
                <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Orientation</div>
                <div className="flex gap-2">
                  {(['landscape','portrait'] as const).map(o => (
                    <button key={o} onClick={() => setOrientation(o)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors
                        ${orientation === o ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                      {o === 'landscape' ? '↔ Paysage' : '↕ Portrait'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Taille du texte</div>
                <div className="flex gap-2">
                  {([['small','Petit'],['normal','Normal'],['large','Grand']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setFontSize(v)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors
                        ${fontSize === v ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Sélection des espèces */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex justify-between items-center mb-2">
                <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                  Espèces à imprimer ({especes.length - especesExclues.size}/{especes.length})
                </div>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => setEspecesExclues(new Set())} className="text-green-700 underline">Tout</button>
                  <button onClick={() => setEspecesExclues(new Set(especes.map(e => e.id)))} className="text-red-500 underline">Aucune</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {especes.map(e => {
                  const exclue = especesExclues.has(e.id)
                  return (
                    <button key={e.id}
                      onClick={() => setEspecesExclues(prev => {
                        const next = new Set(prev)
                        exclue ? next.delete(e.id) : next.add(e.id)
                        return next
                      })}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors
                        ${exclue
                          ? 'bg-white text-gray-300 border-gray-200 line-through'
                          : 'bg-green-700 text-white border-green-700'}`}>
                      {e.nom}
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={() => { setPrintOpen(false); setTimeout(() => window.print(), 100) }}
              className="w-full bg-green-700 text-white py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform">
              🖨️ Lancer l&apos;impression ({especes.length - especesExclues.size} espèces)
            </button>
          </div>
        )}

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
      <div className="hidden print:block text-center py-3 border-b border-gray-200 mb-2">
        <div className="text-xl font-bold">Les Petites Herbes</div>
        <div className="text-sm font-semibold text-gray-600 mt-0.5">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div className="text-[8pt] text-gray-400 mt-0.5">
          {tapisParCaisse} tapis/caisse · {godetsParSerie} godets/série
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
                {visibles.map(c => {
                  const fk = colFormatKey(c.key)
                  return (
                    <th key={c.key}
                      className="px-3 py-2.5 text-center whitespace-nowrap min-w-[70px]"
                      style={fk ? { backgroundColor: fmtColors[fk].header } : undefined}>
                      {c.label}
                      {c.unit && <div className="text-[8px] font-normal opacity-50 leading-tight">{c.unit}</div>}
                      {c.key === 'g_serie_tapis'  && <div className="text-[8px] font-normal opacity-60 leading-tight">×{tapisParCaisse}</div>}
                      {c.key === 'g_serie_godets' && <div className="text-[8px] font-normal opacity-60 leading-tight">×{godetsParSerie}</div>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {especes.filter(e => !especesExclues.has(e.id)).map((e, i) => (
                <tr key={e.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className={`px-3 py-2.5 font-semibold text-gray-800 sticky left-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    {e.nom}
                  </td>
                  {showSection && (
                    <td className="px-3 py-2.5 text-center text-gray-400 text-[10px] capitalize">{e.section ?? ''}</td>
                  )}
                  {visibles.map(c => {
                    const val = c.value(e, tapisParCaisse, godetsParSerie)
                    const isEditing = editCell?.id === e.id && editCell?.key === c.key
                    const fk = colFormatKey(c.key)
                    const cellBg = fk ? fmtColors[fk].light : undefined

                    if (c.calc) {
                      return (
                        <td key={c.key} className="px-3 py-2.5 text-center font-semibold" style={{ backgroundColor: cellBg, color: fk ? fmtColors[fk].header : '#1d4ed8' }}>
                          {val !== null ? val : <span className="opacity-20">—</span>}
                        </td>
                      )
                    }

                    if (c.text) {
                      const textVal = e[c.key as keyof Espece] as string | null
                      return (
                        <td key={c.key} className="px-1 py-1 text-gray-600 min-w-[140px]">
                          {isEditing ? (
                            <textarea autoFocus value={editVal}
                              onChange={ev => setEditVal(ev.target.value)}
                              onBlur={sauvegarder}
                              onKeyDown={ev => { if (ev.key === 'Escape') setEditCell(null) }}
                              disabled={saving}
                              rows={2}
                              className="w-full text-xs border border-green-400 rounded px-2 py-1 focus:outline-none bg-green-50 resize-none" />
                          ) : (
                            <button
                              onClick={() => { setEditCell({ id: e.id, key: c.key as keyof Espece }); setEditVal(textVal ?? '') }}
                              className="w-full min-h-[28px] text-left rounded px-2 py-1 print:pointer-events-none transition-colors text-xs hover:bg-green-50">
                              {textVal
                                ? <span className="text-gray-700">{textVal}</span>
                                : <span className="text-gray-200 text-[9px]">—</span>}
                            </button>
                          )}
                        </td>
                      )
                    }

                    const rawVal = e[c.key as keyof Espece] as number | null
                    return (
                      <td key={c.key} className="px-1 py-1 text-center" style={{ backgroundColor: cellBg }}>
                        {isEditing ? (
                          <input autoFocus value={editVal}
                            onChange={ev => setEditVal(ev.target.value)}
                            onBlur={sauvegarder}
                            onKeyDown={ev => { if (ev.key === 'Enter') sauvegarder(); if (ev.key === 'Escape') setEditCell(null) }}
                            disabled={saving}
                            className="w-16 text-center text-xs border border-green-400 rounded px-1 py-0.5 focus:outline-none bg-white" />
                        ) : (
                          <button
                            onClick={() => { setEditCell({ id: e.id, key: c.key as keyof Espece }); setEditVal(rawVal !== null ? String(rawVal) : '') }}
                            className="w-full min-h-[28px] rounded px-1 py-0.5 print:pointer-events-none transition-colors font-medium"
                            style={{ color: rawVal !== null ? (fk ? fmtColors[fk].header : '#1f2937') : '#e5e7eb' }}>
                            {rawVal !== null ? Math.round(rawVal * 10) / 10 : <span className="text-[9px]">—</span>}
                          </button>
                        )}
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
          nav, .print\\:hidden, aside, dialog, [data-fixed], [class*="fixed"], [class*="z-50"] { display: none !important; }
          td button { display: inline !important; background: none !important; border: none !important; padding: 0 !important; cursor: default; }
          table {
            font-size: ${fontSize === 'small' ? '7.5pt' : fontSize === 'large' ? '11pt' : '9pt'};
            border-collapse: collapse; width: 100%;
          }
          th, td { border: 1px solid #e5e7eb; padding: ${fontSize === 'small' ? '2px 5px' : fontSize === 'large' ? '6px 10px' : '4px 8px'}; }
          th { background: #1f2937!important; color: white!important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr:nth-child(even) td { background: #f9fafb!important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: ${orientation}; margin: 10mm; }
        }
      `}</style>
    </div>
  )
}
