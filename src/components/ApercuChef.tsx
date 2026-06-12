'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ClientLien = { id: string; nom: string; order_token: string | null }

// Bouton flottant (côté gestion) pour basculer vers la vue chef = la boutique.
// Masqué sur les pages boutique elles-mêmes.
export default function ApercuChef() {
  const pathname = usePathname()
  const router   = useRouter()
  const [ouvert, setOuvert]   = useState(false)
  const [clients, setClients] = useState<ClientLien[]>([])
  const [recherche, setRecherche] = useState('')

  const surBoutique = pathname.startsWith('/commander')

  useEffect(() => {
    if (!ouvert || clients.length > 0) return
    supabase.from('clients')
      .select('id, nom, order_token')
      .eq('actif', true)
      .not('order_token', 'is', null)
      .order('nom')
      .then(({ data }) => setClients((data || []) as ClientLien[]))
  }, [ouvert, clients.length])

  if (surBoutique) return null

  const filtres = clients.filter(c => c.nom.toLowerCase().includes(recherche.toLowerCase()))

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className="fixed right-4 z-40 bg-white border border-green-200 shadow-lg rounded-full pl-3 pr-4 py-2.5 flex items-center gap-2 active:scale-95 transition-transform"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
        <span className="text-lg">👁</span>
        <span className="text-sm font-semibold text-green-800">Vue chef</span>
      </button>

      {ouvert && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setOuvert(false)}>
          <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-10 space-y-3 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">👁 Voir la boutique comme un chef</h2>
                <p className="text-xs text-gray-400">Choisissez un client pour ouvrir sa boutique telle qu&apos;il la voit.</p>
              </div>
              <button onClick={() => setOuvert(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            <input
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              placeholder="Rechercher un client…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />

            <div className="space-y-1.5">
              {filtres.map(c => (
                <button key={c.id}
                  onClick={() => { setOuvert(false); router.push(`/commander/${c.order_token}?apercu=1`) }}
                  className="w-full flex items-center justify-between bg-gray-50 hover:bg-green-50 rounded-xl px-3 py-3 text-left transition-colors">
                  <span className="font-semibold text-sm text-gray-800">{c.nom}</span>
                  <span className="text-green-700 text-sm font-semibold">Ouvrir →</span>
                </button>
              ))}
              {filtres.length === 0 && (
                <div className="text-center text-sm text-gray-400 py-6">
                  {clients.length === 0 ? 'Chargement…' : 'Aucun client trouvé'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
