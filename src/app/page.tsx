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

export default function RappelsPage() {
  const [lignes, setLignes] = useState<LigneAvecEspece[]>([])
  const [stockGraines, setStockGraines] = useState<Espece[]>([])
  const [loading, setLoading] = useState(true)
  const [dernierSemis, setDernierSemis] = useState<string | null>(null)
  const [nouvellesCmds, setNouvellesCmds] = useState<BonLivraison[]>([])
  const [caSemaine, setCaSemaine] = useState<number | null>(null)
  const [mouvements, setMouvements] = useState<StockMouvement[]>([])

  useEffect(() => { charger() }, [])

  async function charger() {
    const il_y_a_48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const debutSemaine = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()
    const il_y_a_28j = format(subDays(new Date(), 28), 'yyyy-MM-dd')

    const [
      { data: lignesData },
      { data: especesData },
      { data: semisData },
      { data: cmdData },
      { data: mvtsData },
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
    ])

    if (lignesData) setLignes(lignesData as unknown as LigneAvecEspece[])
    if (especesData) setStockGraines(especesData)
    if (semisData?.[0]) setDernierSemis(semisData[0].date_semis)
    if (mvtsData) setMouvements(mvtsData as StockMouvement[])

    if (cmdData) {
      setNouvellesCmds(cmdData as unknown as BonLivraison[])
    }

    // CA de la semaine : somme de tous les BL cette semaine
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
    const jours = differenceInDays(parseISO(l.date_peremption), aujourd)
    return l.date_dispo <= todayStr && jours >= 0 && jours <= 2
  })

  const disponible = lignes.filter(l => {
    if (!l.date_dispo || !l.date_peremption) return false
    const jours = differenceInDays(parseISO(l.date_peremption), aujourd)
    return l.date_dispo <= todayStr && jours > 2
  })

  const cetteSemaine = lignes.filter(l => {
    if (!l.date_dispo) return false
    const jours = differenceInDays(parseISO(l.date_dispo), aujourd)
    return jours > 0 && jours <= 7
  })

  // Alertes graines intelligentes : basées sur la consommation si dispo, sinon seuils fixes
  function consommationHebdo(especeId: string): number {
    const il_y_a_28j = subDays(new Date(), 28)
    const mvts = mouvements.filter(m => m.espece_id === especeId && new Date(m.created_at) >= il_y_a_28j)
    if (mvts.length === 0) return 0
    return mvts.reduce((s, m) => s + Math.abs(m.quantite_g), 0) / 4
  }

  const grainesUrgentes = stockGraines.filter(e => {
    const hebdo = consommationHebdo(e.id)
    if (hebdo > 0) {
      const semaines = e.stock_actuel_g / hebdo
      return semaines <= 1 // moins d'une semaine
    }
    return e.stock_actuel_g > 0 && e.stock_actuel_g < 200
  })

  const grainesSurveiller = stockGraines.filter(e => {
    if (grainesUrgentes.find(g => g.id === e.id)) return false
    const hebdo = consommationHebdo(e.id)
    if (hebdo > 0) {
      const semaines = e.stock_actuel_g / hebdo
      return semaines <= 2 // moins de 2 semaines
    }
    return e.stock_actuel_g >= 200 && e.stock_actuel_g < 500
  })

  const jourSemaine = format(aujourd, 'EEEE', { locale: fr }).toLowerCase()
  const prochainSemis = jourSemaine === 'lundi' || jourSemaine === 'vendredi'
    ? "C'est jour de semis ! 🌱"
    : null

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      <div className="text-gray-500 text-sm">Chargement...</div>
    </div>
  )

  const toutVide = urgent.length === 0 && disponible.length === 0 && cetteSemaine.length === 0

  return (
    <div className="p-4 space-y-4">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-green-900">🌿 Les Petites Herbes</h1>
          <p className="text-sm text-gray-500 capitalize mt-0.5">
            {format(aujourd, 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <Link href="/semis"
          className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm hover:bg-green-800 transition-colors">
          + Semis
        </Link>
      </div>

      {/* Bandeau jour de semis */}
      {prochainSemis && (
        <div className="bg-green-100 border border-green-300 rounded-xl p-3 flex items-center gap-3">
          <span className="text-2xl">🗓️</span>
          <div>
            <div className="font-semibold text-green-800 text-sm">{prochainSemis}</div>
            {dernierSemis && (
              <div className="text-xs text-green-600">
                Dernier semis : {format(parseISO(dernierSemis), 'EEEE d MMM', { locale: fr })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nouvelles commandes boutique (< 48h) */}
      {nouvellesCmds.length > 0 && (
        <Link href="/commandes" className="block">
          <div className="rounded-xl border border-indigo-200 overflow-hidden shadow-sm">
            <div className="px-3 py-2.5 bg-indigo-600 text-white font-semibold text-sm flex justify-between items-center">
              <span>🔔 NOUVELLES COMMANDES</span>
              <span className="bg-white/20 px-2 rounded-full">{nouvellesCmds.length}</span>
            </div>
            <div className="bg-indigo-50 divide-y divide-indigo-100">
              {nouvellesCmds.map(bl => (
                <div key={bl.id} className="px-3 py-2.5 text-sm flex justify-between items-center">
                  <span className="font-medium">{(bl.client as unknown as { nom: string })?.nom || 'Client'}</span>
                  <span className="text-xs text-indigo-500">
                    {format(parseISO(bl.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Link>
      )}

      {/* CA semaine */}
      {caSemaine !== null && caSemaine > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex justify-between items-center">
          <span className="text-sm text-gray-600">💶 CA cette semaine</span>
          <span className="text-lg font-bold text-green-800">{caSemaine.toFixed(2)}€ TTC</span>
        </div>
      )}

      <Section titre="🔴 URGENT" couleur="red" lignes={urgent} aujourd={aujourd} />
      <Section titre="✅ DISPONIBLE" couleur="green" lignes={disponible} aujourd={aujourd} />
      <Section titre="📅 CETTE SEMAINE" couleur="blue" lignes={cetteSemaine} aujourd={aujourd} />

      {grainesUrgentes.length > 0 && (
        <Link href="/stock" className="block">
          <div className="rounded-xl border border-red-200 overflow-hidden shadow-sm">
            <div className="px-3 py-2.5 bg-red-500 text-white font-semibold text-sm flex justify-between">
              <span>🌾 GRAINES URGENTES</span>
              <span className="bg-white/20 px-2 rounded-full">{grainesUrgentes.length}</span>
            </div>
            <div className="bg-red-50 divide-y divide-red-100">
              {grainesUrgentes.map(e => (
                <div key={e.id} className="px-3 py-2.5 flex justify-between items-center text-sm">
                  <span className="font-medium">{e.nom}</span>
                  <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded-full">
                    {e.stock_actuel_g >= 1000 ? `${(e.stock_actuel_g / 1000).toFixed(2)}kg` : `${e.stock_actuel_g}g`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Link>
      )}

      {grainesSurveiller.length > 0 && (
        <Link href="/stock" className="block">
          <div className="rounded-xl border border-orange-200 overflow-hidden shadow-sm">
            <div className="px-3 py-2.5 bg-orange-500 text-white font-semibold text-sm flex justify-between">
              <span>🟧 À SURVEILLER</span>
              <span className="bg-white/20 px-2 rounded-full">{grainesSurveiller.length}</span>
            </div>
            <div className="bg-orange-50 divide-y divide-orange-100">
              {grainesSurveiller.map(e => (
                <div key={e.id} className="px-3 py-2.5 flex justify-between items-center text-sm">
                  <span className="font-medium">{e.nom}</span>
                  <span className="text-orange-700">
                    {e.stock_actuel_g >= 1000 ? `${(e.stock_actuel_g / 1000).toFixed(2)}kg` : `${e.stock_actuel_g}g`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Link>
      )}

      {toutVide && grainesUrgentes.length === 0 && nouvellesCmds.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🌱</div>
          <p className="font-medium">Tout est sous contrôle !</p>
          <p className="text-sm mt-1">Aucun produit urgent ni graine à risque</p>
          <Link href="/semis"
            className="inline-block mt-4 bg-green-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold">
            Créer un semis
          </Link>
        </div>
      )}
    </div>
  )
}

function Section({ titre, couleur, lignes, aujourd }: {
  titre: string; couleur: 'red' | 'green' | 'blue'; lignes: LigneAvecEspece[]; aujourd: Date
}) {
  const c = {
    red:   { border: 'border-red-200',   bg: 'bg-red-50',   header: 'bg-red-500',   div: 'divide-red-100' },
    green: { border: 'border-green-200', bg: 'bg-green-50', header: 'bg-green-600', div: 'divide-green-100' },
    blue:  { border: 'border-blue-200',  bg: 'bg-blue-50',  header: 'bg-blue-500',  div: 'divide-blue-100' },
  }[couleur]

  if (lignes.length === 0) return null

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden shadow-sm`}>
      <div className={`px-3 py-2.5 ${c.header} text-white font-semibold text-sm flex justify-between items-center`}>
        <span>{titre}</span>
        <span className="bg-white/20 px-2 rounded-full">{lignes.length}</span>
      </div>
      <div className={`${c.bg} divide-y ${c.div}`}>
        {lignes.map(l => {
          const joursRest = l.date_peremption ? differenceInDays(parseISO(l.date_peremption), aujourd) : null
          const joursAvant = l.date_dispo ? differenceInDays(parseISO(l.date_dispo), aujourd) : null
          const ico = l.format === 'TAPIS' ? '🟩' : l.format === 'TERREAU' ? '🟫' : '🟧'
          return (
            <div key={l.id} className="px-3 py-2.5 text-sm">
              <div className="flex justify-between items-start">
                <span className="font-semibold">{ico} {l.espece?.nom}</span>
                {joursRest !== null && joursRest <= 2 && (
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                    {joursRest === 0 ? "Aujourd'hui !" : `${joursRest}j`}
                  </span>
                )}
                {joursAvant !== null && joursAvant > 0 && (
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    dans {joursAvant}j
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1 flex gap-3 flex-wrap">
                <span>×{l.quantite}</span>
                {l.date_dispo && <span>Dispo: {format(parseISO(l.date_dispo), 'd MMM', { locale: fr })}</span>}
                {l.date_peremption && <span>Expire: {format(parseISO(l.date_peremption), 'd MMM', { locale: fr })}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
