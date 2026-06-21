import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export type SemisLignePdf = {
  espece: string
  format: 'TAPIS' | 'GODET' | 'TERREAU'
  quantite: number
  poids: number
  poids_unite?: number
  poids_serie?: number
}

export type SemisDocumentProps = {
  lignes: SemisLignePdf[]
  dateSemis: string
  templateNom?: string
  tapisParCaisse: number
  godetsParSerie: number
}

const c = {
  noir: '#1a1a1a',
  gris: '#555555',
  grisClair: '#f5f5f0',
  border: '#cccccc',
  blanc: '#ffffff',
  vertFonce: '#1B5E20',
}

const s = StyleSheet.create({
  page:      { fontFamily: 'Helvetica', fontSize: 10, color: c.noir, padding: '32 40 32 40' },
  headerBox: { borderBottom: `2 solid ${c.noir}`, paddingBottom: 10, marginBottom: 14 },
  gaec:      { fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  titre:     { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  sousTitre: { fontSize: 9, color: c.gris, marginTop: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  numDoc:    { fontSize: 8, color: c.gris, textAlign: 'right' },

  section:      { marginTop: 14 },
  sectionTitle: { backgroundColor: c.noir, color: c.blanc, fontFamily: 'Helvetica-Bold', fontSize: 9, padding: '4 8', letterSpacing: 0.3 },

  table:     { marginTop: 0 },
  thead:     { flexDirection: 'row', backgroundColor: c.grisClair, borderTop: `1 solid ${c.border}`, borderBottom: `1 solid ${c.border}` },
  th:        { fontFamily: 'Helvetica-Bold', fontSize: 8.5, padding: '4 6' },
  tbody:     {},
  tr:        { flexDirection: 'row', borderBottom: `0.5 solid #eeeeee` },
  trTotal:   { flexDirection: 'row', backgroundColor: c.grisClair, borderTop: `1 solid ${c.border}`, borderBottom: `1 solid ${c.border}` },
  td:        { fontSize: 9, padding: '3.5 6' },
  tdBold:    { fontSize: 9, padding: '3.5 6', fontFamily: 'Helvetica-Bold' },

  colEspece:      { flex: 3.5 },
  colUnite:       { flex: 1.5, textAlign: 'right' },
  colSerie:       { flex: 1.5, textAlign: 'right' },
  colSeries:      { flex: 1.2, textAlign: 'center' },
  colTotal:       { flex: 1.8, textAlign: 'right' },

  recap:      { marginTop: 18, border: `1.5 solid ${c.noir}`, padding: '10 14' },
  recapTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, borderBottom: `1 solid ${c.border}`, paddingBottom: 5, marginBottom: 8, letterSpacing: 0.3 },
  recapRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  recapLabel: { fontSize: 9 },
  recapVal:   { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  recapTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTop: `1 solid ${c.border}`, marginTop: 5, paddingTop: 6 },
  recapTotLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  recapTotVal:   { fontSize: 11, fontFamily: 'Helvetica-Bold' },

  signZone: { flexDirection: 'row', gap: 24, marginTop: 24 },
  signBox:  { flex: 1, border: `1 solid ${c.border}`, height: 50, justifyContent: 'flex-end', padding: '4 6' },
  signLabel:{ fontSize: 8.5, color: c.gris, marginBottom: 4 },
  signLine: { fontSize: 8, color: '#bbbbbb' },

  footer:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 8, borderTop: `0.5 solid ${c.border}` },
  footerTxt:{ fontSize: 8, color: '#aaaaaa' },
})

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function numDoc(dateSemis: string) {
  return `SEM-${dateSemis.replace(/-/g, '')}`
}

export default function SemisDocument({ lignes, dateSemis, templateNom, tapisParCaisse, godetsParSerie }: SemisDocumentProps) {
  const tapis   = lignes.filter(l => l.format === 'TAPIS')
  const terreau = lignes.filter(l => l.format === 'TERREAU')
  const godets  = lignes.filter(l => l.format === 'GODET')

  const totalTapisTapis   = tapis.reduce((s, l) => s + l.quantite * tapisParCaisse, 0)
  const totalTapisCaisses = tapis.reduce((s, l) => s + l.quantite, 0)
  const totalTapisPoids   = tapis.reduce((s, l) => s + l.poids, 0)

  const totalTerreauCaisses = terreau.reduce((s, l) => s + l.quantite, 0)
  const totalTerreauPoids   = terreau.reduce((s, l) => s + l.poids, 0)

  const totalGodetsSeries = godets.reduce((s, l) => s + l.quantite, 0)
  const totalGodetsUnites = godets.reduce((s, l) => s + l.quantite * godetsParSerie, 0)
  const totalGodetsPoids  = godets.reduce((s, l) => s + l.poids, 0)

  const totalPoidsGlobal = totalTapisPoids + totalTerreauPoids + totalGodetsPoids

  const now = new Date()
  const heureStr = `${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── En-tête ── */}
        <View style={s.headerBox}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.gaec}>GAEC Les Petites Herbes</Text>
              <Text style={s.titre}>Bon de travail — Semis du {formatDate(dateSemis)}</Text>
              <Text style={s.sousTitre}>
                {templateNom ? `Template : ${templateNom}  ·  ` : ''}Validé à {heureStr}
              </Text>
            </View>
            <View>
              <Text style={s.numDoc}>{numDoc(dateSemis)}</Text>
              <Text style={s.numDoc}>Imprimé le {formatDate(dateSemis)}</Text>
            </View>
          </View>
        </View>

        {/* ── TAPIS ── */}
        {tapis.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {`TAPIS — micro-pousses   (${totalTapisCaisses} caisse${totalTapisCaisses > 1 ? 's' : ''} · ${totalTapisTapis} tapis)`}
            </Text>
            <View style={s.table}>
              <View style={s.thead}>
                <Text style={[s.th, s.colEspece]}>Espèce</Text>
                <Text style={[s.th, s.colUnite]}>g/tapis</Text>
                <Text style={[s.th, s.colSerie]}>g/série</Text>
                <Text style={[s.th, s.colSeries]}>Séries</Text>
                <Text style={[s.th, s.colTotal]}>Total</Text>
              </View>
              <View style={s.tbody}>
                {tapis.map((l, i) => (
                  <View key={i} style={s.tr}>
                    <Text style={[s.td, s.colEspece]}>{l.espece}</Text>
                    <Text style={[s.td, s.colUnite]}>{l.poids_unite != null ? `${Math.round(l.poids_unite)} g` : '—'}</Text>
                    <Text style={[s.td, s.colSerie]}>{l.poids_serie != null ? `${Math.round(l.poids_serie)} g` : '—'}</Text>
                    <Text style={[s.td, s.colSeries]}>×{l.quantite}</Text>
                    <Text style={[s.td, s.colTotal]}>{Math.round(l.poids)} g</Text>
                  </View>
                ))}
                <View style={s.trTotal}>
                  <Text style={[s.tdBold, s.colEspece]}>TOTAL TAPIS</Text>
                  <Text style={[s.tdBold, s.colUnite]}></Text>
                  <Text style={[s.tdBold, s.colSerie]}></Text>
                  <Text style={[s.tdBold, s.colSeries]}>{totalTapisCaisses}</Text>
                  <Text style={[s.tdBold, s.colTotal]}>{Math.round(totalTapisPoids)} g</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── TERREAU ── */}
        {terreau.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {`TERREAU — caisses directes   (${totalTerreauCaisses} caisse${totalTerreauCaisses > 1 ? 's' : ''})`}
            </Text>
            <View style={s.table}>
              <View style={s.thead}>
                <Text style={[s.th, s.colEspece]}>Espèce</Text>
                <Text style={[s.th, s.colSeries, { textAlign: 'center' }]}>Caisses</Text>
                <Text style={[s.th, s.colUnites, { textAlign: 'right' }]}>Unités</Text>
                <Text style={[s.th, s.colPoids, { textAlign: 'right' }]}>Poids graines</Text>
              </View>
              <View style={s.tbody}>
                {terreau.map((l, i) => (
                  <View key={i} style={s.tr}>
                    <Text style={[s.td, s.colEspece]}>{l.espece}</Text>
                    <Text style={[s.td, s.colSeries, { textAlign: 'center' }]}>×{l.quantite}</Text>
                    <Text style={[s.td, s.colUnites, { textAlign: 'right' }]}>{l.quantite}</Text>
                    <Text style={[s.td, s.colPoids, { textAlign: 'right' }]}>{Math.round(l.poids)} g</Text>
                  </View>
                ))}
                <View style={s.trTotal}>
                  <Text style={[s.tdBold, s.colEspece]}>TOTAL TERREAU</Text>
                  <Text style={[s.tdBold, s.colSeries, { textAlign: 'center' }]}></Text>
                  <Text style={[s.tdBold, s.colUnites, { textAlign: 'right' }]}>{totalTerreauCaisses} caisse{totalTerreauCaisses > 1 ? 's' : ''}</Text>
                  <Text style={[s.tdBold, s.colPoids, { textAlign: 'right' }]}>{Math.round(totalTerreauPoids)} g</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── GODETS ── */}
        {godets.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {`GODETS — plaques   (${totalGodetsSeries} série${totalGodetsSeries > 1 ? 's' : ''} · ${totalGodetsUnites} godets)`}
            </Text>
            <View style={s.table}>
              <View style={s.thead}>
                <Text style={[s.th, s.colEspece]}>Espèce</Text>
                <Text style={[s.th, s.colUnite]}>g/godet</Text>
                <Text style={[s.th, s.colSerie]}>g/série</Text>
                <Text style={[s.th, s.colSeries]}>Séries</Text>
                <Text style={[s.th, s.colTotal]}>Total</Text>
              </View>
              <View style={s.tbody}>
                {godets.map((l, i) => (
                  <View key={i} style={s.tr}>
                    <Text style={[s.td, s.colEspece]}>{l.espece}</Text>
                    <Text style={[s.td, s.colUnite]}>{l.poids_unite != null ? `${Math.round(l.poids_unite)} g` : '—'}</Text>
                    <Text style={[s.td, s.colSerie]}>{l.poids_serie != null ? `${Math.round(l.poids_serie)} g` : '—'}</Text>
                    <Text style={[s.td, s.colSeries]}>×{l.quantite}</Text>
                    <Text style={[s.td, s.colTotal]}>{Math.round(l.poids)} g</Text>
                  </View>
                ))}
                <View style={s.trTotal}>
                  <Text style={[s.tdBold, s.colEspece]}>TOTAL GODETS</Text>
                  <Text style={[s.tdBold, s.colUnite]}></Text>
                  <Text style={[s.tdBold, s.colSerie]}></Text>
                  <Text style={[s.tdBold, s.colSeries]}>{totalGodetsSeries}</Text>
                  <Text style={[s.tdBold, s.colTotal]}>{Math.round(totalGodetsPoids)} g</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Récapitulatif ── */}
        <View style={s.recap}>
          <Text style={s.recapTitle}>RÉCAPITULATIF</Text>
          {tapis.length > 0 && (
            <View style={s.recapRow}>
              <Text style={s.recapLabel}>Tapis (micro-pousses)</Text>
              <Text style={s.recapVal}>{totalTapisCaisses} caisse{totalTapisCaisses > 1 ? 's' : ''} · {totalTapisTapis} plateaux · {Math.round(totalTapisPoids)} g</Text>
            </View>
          )}
          {terreau.length > 0 && (
            <View style={s.recapRow}>
              <Text style={s.recapLabel}>Terreau (directe)</Text>
              <Text style={s.recapVal}>{totalTerreauCaisses} caisse{totalTerreauCaisses > 1 ? 's' : ''} · {Math.round(totalTerreauPoids)} g</Text>
            </View>
          )}
          {godets.length > 0 && (
            <View style={s.recapRow}>
              <Text style={s.recapLabel}>Godets (plaques)</Text>
              <Text style={s.recapVal}>{totalGodetsSeries} série{totalGodetsSeries > 1 ? 's' : ''} · {totalGodetsUnites} godets · {Math.round(totalGodetsPoids)} g</Text>
            </View>
          )}
          <View style={s.recapTotal}>
            <Text style={s.recapTotLabel}>TOTAL GRAINES</Text>
            <Text style={s.recapTotVal}>{Math.round(totalPoidsGlobal)} g</Text>
          </View>
        </View>

        {/* ── Signatures ── */}
        <View style={s.signZone}>
          <View style={s.signBox}>
            <Text style={s.signLabel}>Réalisé par :</Text>
            <Text style={s.signLine}>Signature</Text>
          </View>
          <View style={s.signBox}>
            <Text style={s.signLabel}>Contrôlé par :</Text>
            <Text style={s.signLine}>Signature</Text>
          </View>
        </View>

        {/* ── Pied de page ── */}
        <View style={s.footer}>
          <Text style={s.footerTxt}>GAEC Les Petites Herbes — Bon de travail semis</Text>
          <Text style={s.footerTxt}>Page 1/1</Text>
        </View>

      </Page>
    </Document>
  )
}
