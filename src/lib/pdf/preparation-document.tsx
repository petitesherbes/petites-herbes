/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import path from 'path'

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Roboto',
  fonts: [
    { src: path.join(FONTS_DIR, 'Roboto.ttf'), fontWeight: 'normal' },
    { src: path.join(FONTS_DIR, 'Roboto-Bold.ttf'), fontWeight: 'bold' },
  ],
})

const GREEN = '#1B5E20'
const LIGHT_GREEN = '#E8F5E9'
const LIGHT_GRAY = '#F5F5F5'
const GRAY = '#666'

const s = StyleSheet.create({
  page:          { padding: 28, fontSize: 9, fontFamily: 'Roboto', color: '#222' },
  titleBlock:    { marginBottom: 14 },
  titre:         { fontSize: 16, fontWeight: 'bold', color: GREEN },
  sousTitre:     { fontSize: 10, color: GRAY, marginTop: 2 },
  nbCommandes:   { fontSize: 8, color: '#999', marginTop: 2 },
  separator:     { borderBottomWidth: 1.5, borderBottomColor: GREEN, marginBottom: 14 },

  // Bloc par client
  clientCard:    { marginBottom: 10, borderWidth: 0.5, borderColor: '#ddd', borderRadius: 4 },
  clientHeader:  { backgroundColor: LIGHT_GREEN, padding: '5 8', flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: '#ccc' },
  clientNom:     { fontSize: 10, fontWeight: 'bold', color: GREEN },
  clientNote:    { fontSize: 7.5, color: '#555', fontStyle: 'italic' },
  ligneRow:      { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 8 },
  ligneRowAlt:   { backgroundColor: LIGHT_GRAY },
  ligneDesig:    { flex: 1, fontSize: 8.5 },
  ligneRef:      { width: 44, fontSize: 7.5, color: '#aaa' },
  ligneQte:      { width: 32, fontSize: 9, fontWeight: 'bold', textAlign: 'right', color: GREEN },
  checkbox:      { width: 14, height: 14, borderWidth: 1, borderColor: '#999', borderRadius: 2, marginLeft: 8 },

  // Récap totaux
  recapTitle:    { fontSize: 11, fontWeight: 'bold', color: GREEN, marginTop: 14, marginBottom: 6 },
  recapHeader:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 3, marginBottom: 2 },
  recapThDesig:  { flex: 1, fontSize: 7.5, fontWeight: 'bold', color: GRAY },
  recapThRef:    { width: 44, fontSize: 7.5, fontWeight: 'bold', color: GRAY },
  recapThQte:    { width: 40, fontSize: 7.5, fontWeight: 'bold', color: GRAY, textAlign: 'right' },
  recapRow:      { flexDirection: 'row', paddingVertical: 3.5 },
  recapRowAlt:   { backgroundColor: LIGHT_GRAY },
  recapDesig:    { flex: 1, fontSize: 8.5 },
  recapRef:      { width: 44, fontSize: 7.5, color: '#aaa' },
  recapQte:      { width: 40, fontSize: 9, fontWeight: 'bold', textAlign: 'right' },

  footer:        { position: 'absolute', bottom: 16, left: 28, right: 28, borderTopWidth: 0.5, borderTopColor: '#ccc', paddingTop: 4 },
  footerText:    { fontSize: 6.5, color: '#bbb', textAlign: 'center' },
})

export interface LignePrepa {
  reference: string | null
  designation: string
  quantite: number
}

export interface ClientPrepa {
  nom: string
  note: string | null
  lignes: LignePrepa[]
}

interface Props {
  date: string       // "2026-06-13"
  clients: ClientPrepa[]
  nomGaec?: string
}

export default function PreparationDocument({ date, clients, nomGaec = 'GAEC Les Petites Herbes' }: Props): React.ReactElement<DocumentProps, any> {
  const dateObj = new Date(date + 'T12:00:00')
  const jourSemaine = dateObj.toLocaleDateString('fr-FR', { weekday: 'long' })
  const dateFormatee = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const dateCapitale = jourSemaine.charAt(0).toUpperCase() + jourSemaine.slice(1) + ' ' + dateFormatee

  // Totaux par désignation
  const totaux = new Map<string, { reference: string | null; quantite: number }>()
  for (const c of clients) {
    for (const l of c.lignes) {
      const key = l.designation
      const existing = totaux.get(key)
      if (existing) {
        existing.quantite += l.quantite
      } else {
        totaux.set(key, { reference: l.reference, quantite: l.quantite })
      }
    }
  }
  const lignesRecap = Array.from(totaux.entries())
    .map(([desig, v]) => ({ designation: desig, ...v }))
    .sort((a, b) => a.designation.localeCompare(b.designation))

  return (
    <Document creator={nomGaec} producer="Petites Herbes App">
      <Page size="A4" style={s.page}>

        {/* En-tête */}
        <View style={s.titleBlock}>
          <Text style={s.titre}>Feuille de préparation</Text>
          <Text style={s.sousTitre}>{dateCapitale}</Text>
          <Text style={s.nbCommandes}>{clients.length} commande{clients.length > 1 ? 's' : ''}</Text>
        </View>
        <View style={s.separator} />

        {/* Un bloc par client */}
        {clients.map((c, ci) => (
          <View key={ci} style={s.clientCard} wrap={false}>
            <View style={s.clientHeader}>
              <Text style={s.clientNom}>{c.nom}</Text>
              {c.note ? <Text style={s.clientNote}>{c.note}</Text> : null}
            </View>
            {c.lignes.map((l, li) => (
              <View key={li} style={[s.ligneRow, li % 2 !== 0 ? s.ligneRowAlt : {}]}>
                <Text style={s.ligneRef}>{l.reference || ''}</Text>
                <Text style={s.ligneDesig}>{l.designation}</Text>
                <Text style={s.ligneQte}>{l.quantite}</Text>
                <View style={s.checkbox} />
              </View>
            ))}
          </View>
        ))}

        {/* Récapitulatif totaux */}
        {lignesRecap.length > 0 && (
          <View wrap={false}>
            <Text style={s.recapTitle}>Récapitulatif total à préparer</Text>
            <View style={s.recapHeader}>
              <Text style={s.recapThRef}>Réf.</Text>
              <Text style={s.recapThDesig}>Désignation</Text>
              <Text style={s.recapThQte}>Total</Text>
            </View>
            {lignesRecap.map((l, i) => (
              <View key={i} style={[s.recapRow, i % 2 !== 0 ? s.recapRowAlt : {}]}>
                <Text style={s.recapRef}>{l.reference || ''}</Text>
                <Text style={s.recapDesig}>{l.designation}</Text>
                <Text style={s.recapQte}>{l.quantite}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Pied de page */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{nomGaec} — Préparation du {dateFormatee} — Imprimé le {new Date().toLocaleDateString('fr-FR')}</Text>
        </View>

      </Page>
    </Document>
  )
}
