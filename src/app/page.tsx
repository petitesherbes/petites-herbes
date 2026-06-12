'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Espece, BonLivraison, StockMouvement } from '@/types'
import { format, parseISO, differenceInDays, subDays, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'

interface LigneAvecEspece {
  id: string
  espece_id: string
  format: string
  quantite: number
  date_dispo: string | null
  date_peremption: string | null
  prod_estimee: number | null
  espece: Espece
}

export default function AccueilPage() {
  const [lignes, setLignes]               = useState<LigneAvecEspece[]>([])
  const [stockGraines, setStockGraines]   = useState<Espece[]>([])
  const [loading, setLoading]             = useState(true)
  const [dernierSemis, setDernierSemis]   = useState<string | null>(null)
  const [nouvellesCmds, setNouvellesCmds] = useState<BonLivraison[]>([])
  const [caSemaine, setCaSemaine]         = useState<number | null>(null)
  const [mouvements, setMouvements]       = useState<StockMouvement[]>([])
  const [nbClients, setNbClients]         = useState(0)

  useEffect(() => { charger() }, [])

  async function charger() {
    const il_y_a_48h   = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const debutSemaine = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()
    const il_y_a_28j   = format(subDays(new Date(), 28), 'yyyy-MM-dd')

    const [
      { data: lignesData },
      { data: especesData },
      { data: semisData },
      { data: cmdData },
      { data: mvtsData },
      { count: clientCount },
    ] = await Promise.all([
      supabase
        .from('semis_lignes')
        .select('id, espece_id, format, quantite, date_dispo, date_peremption, prod_estimee, espece:especes(*)')
        .not('date_peremption', 'is', null),
      supabase.from('especes').select('*').eq('actif', true).order('nom'),
      supabase.from('semis').select('date_semis').order('date_semis', { ascending: false }).limit(1),
      supabase.from('bons_livraison')
        .select('*, client:clients(nom), bl_lignes(quantite, prix_ht, tva_pct)')
        .gte('created_at', il_y_a_48h)
        .order('created_at', { ascending: false }),
      supabase.from('stock_mouvements')
        .select('*')
        .eq('type', 'semis')
        .gte('created_at', il_y_a_28j),
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('actif', true),
    ])

    if (lignesData)   setLignes(lignesData as unknown as LigneAvecEspece[])
    if (especesData)  setStockGraines(especesData)
    if (semisData?.[0]) setDernierSemis(semisData[0].date_semis)
    if (mvtsData)     setMouvements(mvtsData as StockMouvement[])
    if (cmdData)      setNouvellesCmds(cmdData as unknown as BonLivraison[])
    if (clientCount)  setNbClients(clientCount)

    const { data: blSemaine } = await supabase
      .from('bons_livraison')
      .select('bl_lignes(quantite, prix_ht, tva_pct)')
      .gte('created_at', debutSemaine)
    if (blSemaine) {
      const total = (blSemaine as unknown as Array<{ bl_lignes: Array<{ quantite: number; prix_ht: number; tva_pct: number }> }>)
        .flatMap(bl => bl.bl_lignes || [])
        .reduce((s, l) => s + l.quantite * l.prix_ht * (1 + l.tva_pct / 100), 0)
      if (total > 0) setCaSemaine(total)
    }
    setLoading(false)
  }

  const aujourd = new Date(); aujourd.setHours(0, 0, 0, 0)
  const todayStr = format(aujourd, 'yyyy-MM-dd')

  const urgent = lignes.filter(l => {
    if (!l.date_dispo || !l.date_peremption) return false
    const j = differenceInDays(parseISO(l.date_peremption), aujourd)
    return l.date_dispo <= todayStr && j >= 0 && j <= 2
  })
  const disponible = lignes.filter(l => {
    if (!l.date_dispo || !l.date_peremption) return false
    const j = differenceInDays(parseISO(l.date_peremption), aujourd)
    return l.date_dispo <= todayStr && j > 2
  })
  const enPousse = lignes.filter(l => {
    if (!l.date_dispo) return false
    return l.date_dispo > todayStr
  }).sort((a, b) => (a.date_dispo! < b.date_dispo! ? -1 : 1))

  function consommationHebdo(especeId: string): number {
    const il_y_a_28j = subDays(new Date(), 28)
    const mvts = mouvements.filter(m => m.espece_id === especeId && new Date(m.created_at) >= il_y_a_28j)
    if (mvts.length === 0) return 0
    return mvts.reduce((s, m) => s + Math.abs(m.quantite_g), 0) / 4
  }

  const grainesUrgentes = stockGraines.filter(e => {
    const hebdo = consommationHebdo(e.id)
    return hebdo > 0 ? e.stock_actuel_g / hebdo <= 1 : (e.stock_actuel_g > 0 && e.stock_actuel_g < 200)
  })
  const grainesSurveiller = stockGraines.filter(e => {
    if (grainesUrgentes.find(g => g.id === e.id)) return false
    const hebdo = consommationHebdo(e.id)
    return hebdo > 0 ? e.stock_actuel_g / hebdo <= 2 : (e.stock_actuel_g >= 200 && e.stock_actuel_g < 500)
  })

  const jourSemaine = format(aujourd, 'EEEE', { locale: fr }).toLowerCase()
  const estJourSemis = jourSemaine === 'lundi' || jourSemaine === 'vendredi'

  function fmtPoids(g: number) {
    return g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      <div className="text-gray-500 text-sm">Chargement...</div>
    </div>
  )

  const nbAlertes = grainesUrgentes.length + grainesSurveiller.length

  return (
    <div className="pb-6">

      {/* ── Header dégradé ── */}
      <div className="bg-green-900 px-5 pt-6 pb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-green-400 text-xs font-semibold uppercase tracking-widest">GAEC Les Petites Herbes</div>
            <h1 className="text-white text-2xl font-bold mt-1">🌿 Tableau de bord</h1>
            <p className="text-green-300 text-sm mt-0.5 capitalize">
              {format(aujourd, 'EEEE d MMMM yyyy', { locale: fr })}
            </p>
          </div>
          <Link href="/semis"
            className="bg-green-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md mt-1">
            + Semis
          </Link>
        </div>

        {estJourSemis && (
          <div className="mt-4 bg-green-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🗓️</span>
            <div>
              <div className="text-white font-semibold text-sm">C&apos;est jour de semis !</div>
              {dernierSemis && (
                <div className="text-green-300 text-xs mt-0.5">
                  Dernier : {format(parseISO(dernierSemis), 'EEEE d MMM', { locale: fr })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Stats flottantes ── */}
      <div className="px-4 -mt-5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon="💶"
            label="CA semaine"
            value={caSemaine != null ? `${caSemaine.toFixed(0)} €` : '—'}
            accent="green"
          />
          <StatCard
            icon="🔔"
            label="Nouvelles cmds"
            value={nouvellesCmds.length > 0 ? String(nouvellesCmds.length) : '—'}
            accent={nouvellesCmds.length > 0 ? 'indigo' : 'gray'}
          />
          <StatCard
            icon="✅"
            label="Dispos récoltés"
            value={disponible.length + urgent.length > 0 ? `${disponible.length + urgent.length}` : '—'}
            accent="green"
          />
          <StatCard
            icon="⚠️"
            label="Alertes stock"
            value={nbAlertes > 0 ? String(nbAlertes) : 'OK'}
            accent={grainesUrgentes.length > 0 ? 'red' : nbAlertes > 0 ? 'orange' : 'green'}
          />
        </div>
      </div>

      {/* ── Raccourcis ── */}
      <div className="px-4 mt-5">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Actions rapides</div>
        <div className="grid grid-cols-3 gap-2.5">
          <Raccourci href="/semis"             icon="🌱" label="Nouveau semis"      />
          <Raccourci href="/commandes/nouveau"  icon="📄" label="Nouveau BL"        />
          <Raccourci href="/commandes"          icon="📦" label="Commandes"         />
          <Raccourci href="/commandes"          icon="🗂️" label="Préparation"       />
          <Raccourci href="/stock"             icon="🌾" label="Stock graines"     />
          <Raccourci href="/couts"             icon="💰" label="Coûts & marges"    />
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">

        {/* ── Nouvelles commandes ── */}
        {nouvellesCmds.length > 0 && (
          <Link href="/commandes" className="block">
            <div className="rounded-2xl border border-indigo-200 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-600 text-white font-bold text-sm flex justify-between items-center">
                <span>🔔 Nouvelles commandes</span>
                <span className="bg-white/25 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {nouvellesCmds.length}
                </span>
              </div>
              <div className="bg-indigo-50 divide-y divide-indigo-100">
                {nouvellesCmds.map(bl => (
                  <div key={bl.id} className="px-4 py-2.5 flex justify-between items-center">
                    <span className="text-sm font-semibold text-indigo-900">
                      {(bl.client as unknown as { nom: string })?.nom || 'Client'}
                    </span>
                    <span className="text-xs text-indigo-400">
                      {format(parseISO(bl.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        )}

        {/* ── Urgent ── */}
        {urgent.length > 0 && (
          <SectionProduction
            titre="Expire bientôt"
            accent="red"
            lignes={urgent}
            aujourd={aujourd}
            icon="🔴"
          />
        )}

        {/* ── Disponible ── */}
        {disponible.length > 0 && (
          <SectionProduction
            titre="Disponible à récolter"
            accent="green"
            lignes={disponible}
            aujourd={aujourd}
            icon="✅"
          />
        )}

        {/* ── En pousse ── */}
        {enPousse.length > 0 && (
          <div className="rounded-2xl border border-blue-200 overflow-hidden">
            <div className="px-4 py-3 bg-blue-600 text-white font-bold text-sm flex justify-between items-center">
              <span>🌱 En pousse</span>
              <span className="bg-white/25 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {enPousse.length}
              </span>
            </div>
            <div className="bg-blue-50 divide-y divide-blue-100">
              {enPousse.slice(0, 8).map(l => {
                const ico      = l.format === 'TAPIS' ? '🟩' : l.format === 'TERREAU' ? '🟫' : '🟧'
                const jAvant   = l.date_dispo ? differenceInDays(parseISO(l.date_dispo), aujourd) : null
                return (
                  <div key={l.id} className="px-4 py-2.5 flex justify-between items-center">
                    <div>
                      <span className="text-sm font-semibold text-blue-900">{ico} {l.espece?.nom}</span>
                      <div className="text-xs text-blue-400 mt-0.5">×{l.quantite} · dispo {l.date_dispo ? format(parseISO(l.date_dispo), 'd MMM', { locale: fr }) : '—'}</div>
                    </div>
                    {jAvant !== null && (
                      <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        J−{jAvant}
                      </span>
                    )}
                  </div>
                )
              })}
              {enPousse.length > 8 && (
                <div className="px-4 py-2.5 text-xs text-blue-400">
                  +{enPousse.length - 8} autres lignes en pousse
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Graines urgentes ── */}
        {grainesUrgentes.length > 0 && (
          <Link href="/stock" className="block">
            <div className="rounded-2xl border border-red-200 overflow-hidden">
              <div className="px-4 py-3 bg-red-500 text-white font-bold text-sm flex justify-between items-center">
                <span>🌾 Stock critique</span>
                <span className="bg-white/25 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {grainesUrgentes.length}
                </span>
              </div>
              <div className="bg-red-50 divide-y divide-red-100">
                {grainesUrgentes.map(e => (
                  <div key={e.id} className="px-4 py-2.5 flex justify-between items-center">
                    <span className="text-sm font-semibold text-red-900">{e.nom}</span>
                    <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      {fmtPoids(e.stock_actuel_g)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        )}

        {/* ── Graines à surveiller ── */}
        {grainesSurveiller.length > 0 && (
          <Link href="/stock" className="block">
            <div className="rounded-2xl border border-amber-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-500 text-white font-bold text-sm flex justify-between items-center">
                <span>🟧 À commander bientôt</span>
                <span className="bg-white/25 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {grainesSurveiller.length}
                </span>
              </div>
              <div className="bg-amber-50 divide-y divide-amber-100">
                {grainesSurveiller.map(e => (
                  <div key={e.id} className="px-4 py-2.5 flex justify-between items-center">
                    <span className="text-sm font-semibold text-amber-900">{e.nom}</span>
                    <span className="text-xs text-amber-700">{fmtPoids(e.stock_actuel_g)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        )}

        {/* ── Infos bas de page ── */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-green-800">{nbClients}</div>
            <div className="text-xs text-gray-400 mt-0.5">clients actifs</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-green-800">{enPousse.length + disponible.length + urgent.length}</div>
            <div className="text-xs text-gray-400 mt-0.5">lignes en production</div>
          </div>
        </div>

        {/* ── Tout vide ── */}
        {urgent.length === 0 && disponible.length === 0 && enPousse.length === 0
          && grainesUrgentes.length === 0 && nouvellesCmds.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">🌱</div>
            <p className="font-semibold text-gray-600">Tout est sous contrôle !</p>
            <p className="text-sm mt-1">Aucun produit urgent, aucune alerte</p>
            <Link href="/semis"
              className="inline-block mt-5 bg-green-700 text-white px-7 py-3 rounded-xl text-sm font-bold shadow-sm">
              Créer un semis
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Composants ───────────────────────────────────────────────

function StatCard({ icon, label, value, accent }: {
  icon: string; label: string; value: string
  accent: 'green' | 'indigo' | 'red' | 'orange' | 'gray'
}) {
  const colors = {
    green:  { bg: 'bg-green-50',  border: 'border-green-200', val: 'text-green-800',  label: 'text-green-600' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200',val: 'text-indigo-800', label: 'text-indigo-500' },
    red:    { bg: 'bg-red-50',    border: 'border-red-200',   val: 'text-red-700',    label: 'text-red-500' },
    orange: { bg: 'bg-amber-50',  border: 'border-amber-200', val: 'text-amber-700',  label: 'text-amber-500' },
    gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',  val: 'text-gray-600',   label: 'text-gray-400' },
  }[accent]

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-2xl px-4 py-3 bg-white shadow-sm`}>
      <div className={`text-xs font-medium ${colors.label} flex items-center gap-1.5`}>
        <span>{icon}</span>{label}
      </div>
      <div className={`text-xl font-bold ${colors.val} mt-1`}>{value}</div>
    </div>
  )
}

function Raccourci({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href}
      className="bg-white border border-gray-100 rounded-2xl flex flex-col items-center justify-center py-3.5 gap-1.5 shadow-sm active:scale-95 transition-transform">
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-xs font-semibold text-gray-600 text-center leading-tight px-1">{label}</span>
    </Link>
  )
}

function SectionProduction({ titre, accent, lignes, aujourd, icon }: {
  titre: string; accent: 'red' | 'green'; icon: string
  lignes: LigneAvecEspece[]; aujourd: Date
}) {
  const c = {
    red:   { border: 'border-red-200',   bg: 'bg-red-50',    header: 'bg-red-500',    div: 'divide-red-100',   badge: 'bg-red-100 text-red-700',   name: 'text-red-900' },
    green: { border: 'border-green-200', bg: 'bg-green-50',  header: 'bg-green-600',  div: 'divide-green-100', badge: 'bg-green-100 text-green-700', name: 'text-green-900' },
  }[accent]

  return (
    <div className={`rounded-2xl border ${c.border} overflow-hidden`}>
      <div className={`px-4 py-3 ${c.header} text-white font-bold text-sm flex justify-between items-center`}>
        <span>{icon} {titre}</span>
        <span className="bg-white/25 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{lignes.length}</span>
      </div>
      <div className={`${c.bg} divide-y ${c.div}`}>
        {lignes.map(l => {
          const joursRest  = l.date_peremption ? differenceInDays(parseISO(l.date_peremption), aujourd) : null
          const ico        = l.format === 'TAPIS' ? '🟩' : l.format === 'TERREAU' ? '🟫' : '🟧'
          return (
            <div key={l.id} className="px-4 py-2.5 flex justify-between items-center">
              <div>
                <span className={`text-sm font-semibold ${c.name}`}>{ico} {l.espece?.nom}</span>
                <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                  <span>×{l.quantite}</span>
                  {l.date_peremption && (
                    <span>exp. {format(parseISO(l.date_peremption), 'd MMM', { locale: fr })}</span>
                  )}
                </div>
              </div>
              {joursRest !== null && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                  {joursRest === 0 ? "Auj." : `${joursRest}j`}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
