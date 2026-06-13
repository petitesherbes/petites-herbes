'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Espece, BonLivraison, StockMouvement } from '@/types'
import { format, parseISO, differenceInDays, subDays, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import MeteoWidget from '@/components/MeteoWidget'

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
  const [tachesAujourdHui, setTachesAujourdHui] = useState<{id:string;titre:string;priorite:string;completions:{date_completion:string}[]}[]>([])
  const [blsSemaine, setBlsSemaine]       = useState<{client:{nom:string}|null;created_at:string;montant:number}[]>([])
  const [pointagesAuj, setPointagesAuj]   = useState<{auteur:string;heure_arrivee:string|null;heure_depart:string|null;pause_minutes:number}[]>([])
  const [statOuverte, setStatOuverte]     = useState<'ca'|'commandes'|'dispos'|'alertes'|null>(null)

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
      { data: tachesData },
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
      supabase.from('taches')
        .select('id, titre, priorite, type, frequence, date_echeance, completions:taches_completions(date_completion)')
        .eq('actif', true),
    ])

    if (lignesData)   setLignes(lignesData as unknown as LigneAvecEspece[])
    if (especesData)  setStockGraines(especesData)
    if (semisData?.[0]) setDernierSemis(semisData[0].date_semis)
    if (mvtsData)     setMouvements(mvtsData as StockMouvement[])
    if (cmdData)      setNouvellesCmds(cmdData as unknown as BonLivraison[])
    if (clientCount)  setNbClients(clientCount)

    // Filtrer les tâches du jour
    if (tachesData) {
      const today = new Date()
      const todayStr = format(today, 'yyyy-MM-dd')
      const jourFr = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][today.getDay()]
      const duJour = (tachesData as unknown as {id:string;titre:string;priorite:string;type:string;frequence:string|null;date_echeance:string|null;completions:{date_completion:string}[]}[])
        .filter(t => {
          if (t.type === 'ponctuelle') return t.date_echeance === todayStr
          if (!t.frequence) return false
          const freq = t.frequence.toLowerCase()
          if (freq === 'quotidien') return true
          return freq.split(',').map((s: string) => s.trim()).includes(jourFr)
        })
      setTachesAujourdHui(duJour)
    }

    const { data: blSemaine } = await supabase
      .from('bons_livraison')
      .select('created_at, client:clients(nom), bl_lignes(quantite, prix_ht, tva_pct)')
      .gte('created_at', debutSemaine)
      .order('created_at', { ascending: false })
    if (blSemaine) {
      type BLRaw = { created_at: string; client: {nom:string}|null; bl_lignes: {quantite:number;prix_ht:number;tva_pct:number}[] }
      const raw = blSemaine as unknown as BLRaw[]
      const total = raw.flatMap(bl => bl.bl_lignes || [])
        .reduce((s, l) => s + l.quantite * l.prix_ht * (1 + l.tva_pct / 100), 0)
      if (total > 0) setCaSemaine(total)
      setBlsSemaine(raw.map(bl => ({
        client: bl.client,
        created_at: bl.created_at,
        montant: (bl.bl_lignes || []).reduce((s, l) => s + l.quantite * l.prix_ht * (1 + l.tva_pct / 100), 0),
      })))
    }

    const { data: ptg } = await supabase
      .from('pointages')
      .select('auteur, heure_arrivee, heure_depart, pause_minutes')
      .eq('date', format(new Date(), 'yyyy-MM-dd'))
    if (ptg) setPointagesAuj(ptg as {auteur:string;heure_arrivee:string|null;heure_depart:string|null;pause_minutes:number}[])

    setLoading(false)
  }

  const aujourd = new Date(); aujourd.setHours(0, 0, 0, 0)
  const todayStr = format(aujourd, 'yyyy-MM-dd')

  const recoltesAujourdHui = lignes.filter(l => l.date_dispo === todayStr)

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
          <div className="flex flex-col gap-2 mt-1">
            <Link href="/semis"
              className="bg-green-500 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-md text-center">
              + Semis
            </Link>
            <Link href="/terrain"
              onClick={() => { if (typeof window !== 'undefined') localStorage.setItem('terrain_init_tab', 'agenda') }}
              className="bg-green-700 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-md text-center">
              + Tâche
            </Link>
          </div>
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

      {/* ── Météo ── */}
      <div className="px-4 mt-4">
        <MeteoWidget />
      </div>

      {/* ── Pointages du jour ── */}
      <div className="px-4 mt-4">
        <PointageBlock pointages={pointagesAuj} />
      </div>

      {/* ── Agenda de la semaine ── */}
      <div className="px-4 mt-4">
        <AgendaSemaine />
      </div>

      {/* ── Écran du matin ── */}
      {(recoltesAujourdHui.length > 0 || tachesAujourdHui.length > 0) && (
        <div className="px-4 mt-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Aujourd&apos;hui</div>
          <div className="rounded-2xl border border-green-200 overflow-hidden">
            {/* Récoltes du jour */}
            {recoltesAujourdHui.length > 0 && (
              <>
                <div className="px-4 py-2.5 bg-emerald-600 text-white font-bold text-sm flex items-center justify-between">
                  <span>✂️ À récolter aujourd&apos;hui</span>
                  <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {recoltesAujourdHui.length}
                  </span>
                </div>
                <div className="divide-y divide-green-100 bg-emerald-50">
                  {recoltesAujourdHui.map(l => (
                    <Link key={l.id} href="/historique" className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <span className="text-sm font-semibold text-emerald-900">{l.espece?.nom}</span>
                        <div className="text-xs text-emerald-600 mt-0.5">
                          ×{l.quantite} · {l.format === 'TAPIS' ? '🟩 Tapis' : l.format === 'TERREAU' ? '🟫 Terreau' : '🟧 Hydro'}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Prêt ✓</span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {/* Tâches du jour */}
            {tachesAujourdHui.length > 0 && (
              <>
                <div className={`px-4 py-2.5 bg-amber-500 text-white font-bold text-sm flex items-center justify-between ${recoltesAujourdHui.length > 0 ? 'border-t border-amber-400' : ''}`}>
                  <span>✅ Tâches du jour</span>
                  <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {tachesAujourdHui.filter(t => !t.completions.some(c => c.date_completion === todayStr)).length} restantes
                  </span>
                </div>
                <div className="divide-y divide-amber-100 bg-amber-50">
                  {tachesAujourdHui.map(t => {
                    const faite = t.completions.some(c => c.date_completion === todayStr)
                    return (
                      <Link key={t.id} href="/terrain" className="flex items-center gap-3 px-4 py-2.5">
                        <span className={`text-base ${faite ? 'opacity-40' : ''}`}>
                          {faite ? '✅' : '⬜'}
                        </span>
                        <span className={`text-sm font-semibold ${faite ? 'line-through text-gray-400' : 'text-amber-900'}`}>
                          {t.titre}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Stats flottantes (cliquables) ── */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon="💶" label="CA semaine"
            value={caSemaine != null ? `${caSemaine.toFixed(0)} €` : '—'}
            accent="green" onClick={() => setStatOuverte('ca')}
          />
          <StatCard
            icon="🔔" label="Nouvelles cmds"
            value={nouvellesCmds.length > 0 ? String(nouvellesCmds.length) : '—'}
            accent={nouvellesCmds.length > 0 ? 'indigo' : 'gray'}
            onClick={() => setStatOuverte('commandes')}
          />
          <StatCard
            icon="✅" label="Dispos récoltés"
            value={disponible.length + urgent.length > 0 ? `${disponible.length + urgent.length}` : '—'}
            accent="green" onClick={() => setStatOuverte('dispos')}
          />
          <StatCard
            icon="⚠️" label="Alertes stock"
            value={nbAlertes > 0 ? String(nbAlertes) : 'OK'}
            accent={grainesUrgentes.length > 0 ? 'red' : nbAlertes > 0 ? 'orange' : 'green'}
            onClick={() => setStatOuverte('alertes')}
          />
        </div>
      </div>

      {/* ── Drawer détail stats ── */}
      {statOuverte && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setStatOuverte(null)}>
          <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-base">
                {statOuverte === 'ca'        && '💶 CA de la semaine'}
                {statOuverte === 'commandes' && '🔔 Nouvelles commandes'}
                {statOuverte === 'dispos'    && '✅ Produits disponibles'}
                {statOuverte === 'alertes'   && '⚠️ Alertes stock graines'}
              </h2>
              <button onClick={() => setStatOuverte(null)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            {/* CA semaine */}
            {statOuverte === 'ca' && (
              <div className="divide-y divide-gray-100">
                {blsSemaine.length === 0 && (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">Aucun BL cette semaine</div>
                )}
                {blsSemaine.map((bl, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-gray-800">{bl.client?.nom || 'Client inconnu'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {format(parseISO(bl.created_at), "EEE d MMM 'à' HH:mm", { locale: fr })}
                      </div>
                    </div>
                    <span className="font-bold text-green-700">{bl.montant.toFixed(2)} €</span>
                  </div>
                ))}
                {blsSemaine.length > 0 && (
                  <div className="px-5 py-3.5 flex items-center justify-between bg-green-50">
                    <span className="font-bold text-green-800">Total semaine</span>
                    <span className="font-bold text-green-800 text-lg">{caSemaine?.toFixed(2)} €</span>
                  </div>
                )}
              </div>
            )}

            {/* Nouvelles commandes */}
            {statOuverte === 'commandes' && (
              <div className="divide-y divide-gray-100">
                {nouvellesCmds.length === 0 && (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">Aucune commande récente</div>
                )}
                {nouvellesCmds.map(bl => {
                  const total = ((bl as unknown as {bl_lignes:{quantite:number;prix_ht:number;tva_pct:number}[]}).bl_lignes || [])
                    .reduce((s, l) => s + l.quantite * l.prix_ht * (1 + l.tva_pct / 100), 0)
                  return (
                    <Link key={bl.id} href="/commandes" onClick={() => setStatOuverte(null)}
                      className="px-5 py-3.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-gray-800">
                          {(bl.client as unknown as {nom:string})?.nom || 'Client'}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {format(parseISO(bl.created_at), "EEE d MMM 'à' HH:mm", { locale: fr })}
                        </div>
                      </div>
                      <span className="font-bold text-indigo-700">{total.toFixed(2)} €</span>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Dispos */}
            {statOuverte === 'dispos' && (
              <div className="divide-y divide-gray-100">
                {urgent.length === 0 && disponible.length === 0 && (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">Rien à récolter pour l&apos;instant</div>
                )}
                {[...urgent, ...disponible].map(l => {
                  const joursRest = l.date_peremption ? differenceInDays(parseISO(l.date_peremption), aujourd) : null
                  const ico = l.format === 'TAPIS' ? '🟩' : l.format === 'TERREAU' ? '🟫' : '🟧'
                  return (
                    <div key={l.id} className="px-5 py-3.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-gray-800">{ico} {l.espece?.nom}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          ×{l.quantite} · exp. {l.date_peremption ? format(parseISO(l.date_peremption), 'd MMM', { locale: fr }) : '—'}
                        </div>
                      </div>
                      {joursRest !== null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${joursRest <= 2 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {joursRest === 0 ? 'Auj.' : `${joursRest}j`}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Alertes stock */}
            {statOuverte === 'alertes' && (
              <div className="divide-y divide-gray-100">
                {grainesUrgentes.length > 0 && (
                  <div className="px-5 py-2 bg-red-50 text-xs font-bold text-red-600 uppercase tracking-wider">
                    🔴 Stock critique
                  </div>
                )}
                {grainesUrgentes.map(e => (
                  <div key={e.id} className="px-5 py-3.5 flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-800">{e.nom}</span>
                    <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      {e.stock_actuel_g >= 1000 ? `${(e.stock_actuel_g/1000).toFixed(1)} kg` : `${e.stock_actuel_g} g`}
                    </span>
                  </div>
                ))}
                {grainesSurveiller.length > 0 && (
                  <div className="px-5 py-2 bg-amber-50 text-xs font-bold text-amber-600 uppercase tracking-wider">
                    🟧 À commander bientôt
                  </div>
                )}
                {grainesSurveiller.map(e => (
                  <div key={e.id} className="px-5 py-3.5 flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-800">{e.nom}</span>
                    <span className="text-xs text-amber-700">
                      {e.stock_actuel_g >= 1000 ? `${(e.stock_actuel_g/1000).toFixed(1)} kg` : `${e.stock_actuel_g} g`}
                    </span>
                  </div>
                ))}
                {nbAlertes === 0 && (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">Stocks OK ✅</div>
                )}
              </div>
            )}

            <div className="h-8" />
          </div>
        </div>
      )}

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

function StatCard({ icon, label, value, accent, onClick }: {
  icon: string; label: string; value: string
  accent: 'green' | 'indigo' | 'red' | 'orange' | 'gray'
  onClick?: () => void
}) {
  const colors = {
    green:  { bg: 'bg-green-50',  border: 'border-green-200', val: 'text-green-800',  label: 'text-green-600' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200',val: 'text-indigo-800', label: 'text-indigo-500' },
    red:    { bg: 'bg-red-50',    border: 'border-red-200',   val: 'text-red-700',    label: 'text-red-500' },
    orange: { bg: 'bg-amber-50',  border: 'border-amber-200', val: 'text-amber-700',  label: 'text-amber-500' },
    gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',  val: 'text-gray-600',   label: 'text-gray-400' },
  }[accent]

  return (
    <button onClick={onClick}
      className={`${colors.bg} border ${colors.border} rounded-2xl px-4 py-3 bg-white shadow-sm text-left w-full active:scale-95 transition-transform`}>
      <div className={`text-xs font-medium ${colors.label} flex items-center gap-1.5`}>
        <span>{icon}</span>{label}
        {onClick && <span className="ml-auto text-[10px] opacity-40">détail →</span>}
      </div>
      <div className={`text-xl font-bold ${colors.val} mt-1`}>{value}</div>
    </button>
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

function PointageBlock({ pointages }: { pointages: {auteur:string;heure_arrivee:string|null;heure_depart:string|null;pause_minutes:number}[] }) {
  const personnes = ['Antoine', 'Lucas']

  function duree(p: {heure_arrivee:string|null;heure_depart:string|null;pause_minutes:number}): string | null {
    if (!p.heure_arrivee || !p.heure_depart) return null
    const [ah, am] = p.heure_arrivee.split(':').map(Number)
    const [dh, dm] = p.heure_depart.split(':').map(Number)
    const total = (dh * 60 + dm) - (ah * 60 + am) - p.pause_minutes
    if (total <= 0) return null
    const h = Math.floor(total / 60), m = total % 60
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
  }

  function ouvrirHeures() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('terrain_init_tab', 'heures')
    }
  }

  return (
    <div>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Heures de travail</div>
      <div className="grid grid-cols-2 gap-3">
        {personnes.map(nom => {
          const p = pointages.find(x => x.auteur === nom)
          return (
            <Link key={nom} href="/terrain" onClick={ouvrirHeures}
              className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm active:scale-95 transition-transform">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-gray-800">{nom}</span>
                <span className="text-lg">{nom === 'Antoine' ? '👨‍🌾' : '🧑‍🌾'}</span>
              </div>
              {p?.heure_arrivee ? (
                <>
                  <div className="text-xs text-gray-500">
                    {p.heure_arrivee.slice(0,5)} → {p.heure_depart ? p.heure_depart.slice(0,5) : '…'}
                  </div>
                  {duree(p) && (
                    <div className="text-base font-bold text-green-700 mt-0.5">{duree(p)}</div>
                  )}
                  {!p.heure_depart && (
                    <div className="text-xs text-amber-600 font-semibold mt-0.5">En cours ●</div>
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-400 mt-0.5">Pas encore pointé</div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

const ROUTINE: { jour: string; court: string; activites: { emoji: string; label: string }[] }[] = [
  { jour: 'Lundi',    court: 'Lun', activites: [{ emoji: '🌱', label: 'Semis' }, { emoji: '🌾', label: 'Récolte' }, { emoji: '💧', label: '×3' }] },
  { jour: 'Mardi',   court: 'Mar', activites: [{ emoji: '📦', label: 'Livraison' }, { emoji: '💧', label: '×3' }] },
  { jour: 'Mercredi',court: 'Mer', activites: [{ emoji: '🌾', label: 'Récolte' }, { emoji: '💧', label: '×3' }] },
  { jour: 'Jeudi',   court: 'Jeu', activites: [{ emoji: '🌾', label: 'Récolte' }, { emoji: '📦', label: 'Livraison' }, { emoji: '💧', label: '×3' }] },
  { jour: 'Vendredi',court: 'Ven', activites: [{ emoji: '🌱', label: 'Semis' }, { emoji: '📦', label: 'Livraison' }, { emoji: '💧', label: '×3' }] },
  { jour: 'Samedi',  court: 'Sam', activites: [{ emoji: '💧', label: '×3' }] },
  { jour: 'Dimanche',court: 'Dim', activites: [{ emoji: '💧', label: '×3' }] },
]

function AgendaSemaine() {
  const jourIdx = new Date().getDay() // 0=dim
  const routineIdx = jourIdx === 0 ? 6 : jourIdx - 1

  function ouvrirAgenda() {
    if (typeof window !== 'undefined') localStorage.setItem('terrain_init_tab', 'agenda')
  }

  return (
    <div>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Rythme de la semaine</div>
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {ROUTINE.map((r, i) => {
          const estAujourdHui = i === routineIdx
          return (
            <Link key={r.jour} href="/terrain" onClick={ouvrirAgenda}
              className={`flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0
                active:bg-gray-50 transition-colors
                ${estAujourdHui ? 'bg-green-50 active:bg-green-100' : ''}`}>
              <div className={`w-9 text-xs font-bold pt-0.5 shrink-0
                ${estAujourdHui ? 'text-green-700' : 'text-gray-400'}`}>
                {r.court}
                {estAujourdHui && <div className="text-[9px] text-green-500">auj.</div>}
              </div>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {r.activites.map((a, j) => (
                  <span key={j}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                      ${estAujourdHui ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {a.emoji} {a.label}
                  </span>
                ))}
              </div>
              <span className="text-gray-300 text-xs pt-0.5">›</span>
            </Link>
          )
        })}
      </div>
    </div>
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
