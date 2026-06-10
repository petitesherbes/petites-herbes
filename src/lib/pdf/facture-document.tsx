/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import path from 'path'
import { ParamsDocs, ClientPDF, GroupeBLFacture } from './types'

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
const GRAY = '#666666'
const LIGHT_GRAY = '#F5F5F5'
const LIGHT_BL = '#F0F4FF'

const s = StyleSheet.create({
  page:          { padding: 30, fontSize: 9, fontFamily: 'Roboto', color: '#333' },
  headerRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft:    { flex: 1 },
  headerRight:   { alignItems: 'flex-end' },
  companyName:   { fontSize: 14, fontWeight: 'bold', color: GREEN, marginBottom: 3 },
  companyLine:   { fontSize: 8.5, color: GRAY, marginBottom: 1.5 },
  companyActiv:  { fontSize: 8, color: '#888', fontStyle: 'italic', marginTop: 3 },
  docLabel:      { fontSize: 8, color: GRAY, textTransform: 'uppercase', letterSpacing: 1 },
  docNumero:     { fontSize: 18, fontWeight: 'bold', color: GREEN, marginTop: 2 },
  docDate:       { fontSize: 8.5, color: GRAY, marginTop: 2 },
  separator:     { borderBottomWidth: 1.5, borderBottomColor: GREEN, marginBottom: 14 },
  clientBox:     { backgroundColor: LIGHT_GRAY, padding: 10, marginBottom: 14, borderRadius: 3 },
  clientName:    { fontSize: 9.5, fontWeight: 'bold', marginBottom: 2 },
  clientLine:    { fontSize: 8.5, color: GRAY, marginBottom: 1 },
  tableHeader:   { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: '#222', paddingBottom: 4, marginBottom: 2 },
  thRef:         { width: 50, fontSize: 7.5, fontWeight: 'bold', color: GRAY },
  thDesig:       { flex: 1, fontSize: 7.5, fontWeight: 'bold', color: GRAY },
  thPu:          { width: 42, fontSize: 7.5, fontWeight: 'bold', color: GRAY, textAlign: 'right' },
  thQte:         { width: 28, fontSize: 7.5, fontWeight: 'bold', color: GRAY, textAlign: 'right' },
  thMontant:     { width: 48, fontSize: 7.5, fontWeight: 'bold', color: GRAY, textAlign: 'right' },
  thTva:         { width: 30, fontSize: 7.5, fontWeight: 'bold', color: GRAY, textAlign: 'right' },
  blGroupHeader: { flexDirection: 'row', backgroundColor: LIGHT_BL, paddingVertical: 4, paddingHorizontal: 4, marginTop: 6, marginBottom: 1 },
  blGroupText:   { fontSize: 8, fontWeight: 'bold', color: '#3b5bdb' },
  row:           { flexDirection: 'row', paddingVertical: 3 },
  rowAlt:        { backgroundColor: LIGHT_GRAY },
  tdRef:         { width: 50, fontSize: 8, color: '#999' },
  tdDesig:       { flex: 1, fontSize: 8.5 },
  tdPu:          { width: 42, fontSize: 8, textAlign: 'right' },
  tdQte:         { width: 28, fontSize: 8, fontWeight: 'bold', textAlign: 'right' },
  tdMontant:     { width: 48, fontSize: 8, textAlign: 'right' },
  tdTva:         { width: 30, fontSize: 8, textAlign: 'right', color: GRAY },
  totauxBox:     { marginTop: 14, borderTopWidth: 0.5, borderTopColor: '#ccc', paddingTop: 8 },
  totauxRow:     { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3 },
  totauxLabel:   { fontSize: 8.5, color: GRAY, width: 120, textAlign: 'right', marginRight: 16 },
  totauxValue:   { fontSize: 8.5, width: 70, textAlign: 'right' },
  totauxNetLabel:{ fontSize: 10, fontWeight: 'bold', width: 120, textAlign: 'right', marginRight: 16 },
  totauxNetValue:{ fontSize: 10, fontWeight: 'bold', color: GREEN, width: 70, textAlign: 'right' },
  conditionsBox: { marginTop: 12, backgroundColor: LIGHT_GRAY, padding: 8, borderRadius: 3 },
  conditionsText:{ fontSize: 7.5, color: GRAY, lineHeight: 1.6 },
  ribBox:        { marginTop: 10, borderWidth: 0.5, borderColor: '#ccc', padding: 8, borderRadius: 3 },
  ribTitle:      { fontSize: 8, fontWeight: 'bold', marginBottom: 4, color: GREEN },
  ribRow:        { flexDirection: 'row', marginBottom: 2 },
  ribLabel:      { fontSize: 7.5, color: GRAY, width: 80 },
  ribValue:      { fontSize: 7.5, fontWeight: 'bold' },
  ribCodes:      { flexDirection: 'row', marginTop: 4, gap: 8 },
  ribCodeLabel:  { fontSize: 7, color: '#aaa' },
  ribCodeValue:  { fontSize: 7.5 },
  mentionText:   { fontSize: 7, color: '#aaa', marginTop: 6, lineHeight: 1.5 },
  footer:        { position: 'absolute', bottom: 20, left: 30, right: 30, borderTopWidth: 0.5, borderTopColor: '#ccc', paddingTop: 6 },
  footerText:    { fontSize: 7, color: '#aaa', textAlign: 'center', lineHeight: 1.6 },
  logo:          { width: 60, height: 30, objectFit: 'contain', marginBottom: 4 },
})

interface Props {
  numero: string
  date: string
  client: ClientPDF
  groupes: GroupeBLFacture[]
  params: ParamsDocs
}

export default function FactureDocument({ numero, date, client, groupes, params }: Props): React.ReactElement<DocumentProps, any> {
  const dateFormatee = new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit'
  })

  // Calculs totaux
  const toutesLignes = groupes.flatMap(g => g.lignes)
  const totalHT = toutesLignes.reduce((s, l) => s + l.prix_ht * l.quantite, 0)
  const totalTVA55 = toutesLignes
    .filter(l => l.tva_pct === 5.5)
    .reduce((s, l) => s + l.prix_ht * l.quantite * 0.055, 0)
  const totalTTC = toutesLignes.reduce((s, l) => s + l.prix_ht * l.quantite * (1 + l.tva_pct / 100), 0)

  // Échéance selon délai
  const dateEcheance = new Date(date)
  dateEcheance.setDate(dateEcheance.getDate() + (params.delai_paiement_jours || 0))
  const echeance = dateEcheance.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const footerLine1 = `${params.nom} - ${params.adresse} - ${params.code_postal} ${params.ville.toUpperCase()}`
  const footerLine2 = `Au capital de ${params.capital}€ - RCS ${params.rcs} N°SIRET : ${params.siret} - TVA Intra. : ${params.tva_intra} - APE/NAF : ${params.ape_naf}${params.certification_bio ? ` * Certifié par ${params.certification_bio}` : ''}`

  let rowIndex = 0

  return (
    <Document creator="GAEC Les Petites Herbes" producer="Petites Herbes App">
      <Page size="A4" style={s.page}>

        {/* En-tête */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            {params.logo_url && <Image src={params.logo_url} style={s.logo} />}
            <Text style={s.companyName}>{params.nom}</Text>
            <Text style={s.companyLine}>{params.adresse}</Text>
            <Text style={s.companyLine}>{params.code_postal} {params.ville}</Text>
            <Text style={s.companyLine}>Tél : {params.telephone}</Text>
            <Text style={s.companyLine}>Email : {params.email}</Text>
            {params.activite && <Text style={s.companyActiv}>{params.activite}</Text>}
          </View>
          <View style={s.headerRight}>
            <Text style={s.docLabel}>Récapitulatif mensuel</Text>
            <Text style={s.docNumero}>N° {numero}</Text>
            <Text style={s.docDate}>Le : {dateFormatee}</Text>
          </View>
        </View>

        <View style={s.separator} />

        {/* Bloc client */}
        <View style={s.clientBox}>
          <Text style={s.clientName}>{client.nom}</Text>
          {client.adresse && <Text style={s.clientLine}>{client.adresse}</Text>}
          {(client.code_postal || client.ville) && (
            <Text style={s.clientLine}>{client.code_postal} {client.ville}</Text>
          )}
          <Text style={s.clientLine}>{client.pays || 'FRANCE'}</Text>
          {client.tva_intra && <Text style={[s.clientLine, { marginTop: 2 }]}>{client.tva_intra}</Text>}
          {client.siret && <Text style={s.clientLine}>{client.siret}</Text>}
        </View>

        {/* En-têtes tableau */}
        <View style={s.tableHeader}>
          <Text style={s.thRef}>Réf.</Text>
          <Text style={s.thDesig}>Désignation</Text>
          <Text style={s.thPu}>PU HT</Text>
          <Text style={s.thQte}>Qté</Text>
          <Text style={s.thMontant}>Mont.HT</Text>
          <Text style={s.thTva}>TVA</Text>
        </View>

        {/* Lignes groupées par BL */}
        {groupes.map((g) => (
          <View key={g.numero} wrap={false}>
            {/* Sous-titre BL */}
            <View style={s.blGroupHeader}>
              <Text style={s.blGroupText}>
                Bon de livraison n°{g.numero} du {new Date(g.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </Text>
            </View>
            {g.lignes.map((l, i) => {
              const isAlt = rowIndex++ % 2 !== 0
              return (
                <View key={i} style={[s.row, isAlt ? s.rowAlt : {}]}>
                  <Text style={s.tdRef}>{l.reference || ''}</Text>
                  <Text style={s.tdDesig}>{l.designation}</Text>
                  <Text style={s.tdPu}>{l.prix_ht > 0 ? l.prix_ht.toFixed(2) : ''}</Text>
                  <Text style={s.tdQte}>{l.quantite}</Text>
                  <Text style={s.tdMontant}>{l.prix_ht > 0 ? (l.prix_ht * l.quantite).toFixed(2) : ''}</Text>
                  <Text style={s.tdTva}>{l.tva_pct > 0 ? l.tva_pct : ''}</Text>
                </View>
              )
            })}
          </View>
        ))}

        {/* Totaux */}
        <View style={s.totauxBox}>
          <View style={s.totauxRow}>
            <Text style={s.totauxLabel}>TVA 5,5% : {totalTVA55.toFixed(2)} € ({totalHT.toFixed(2)} € HT)</Text>
            <Text style={s.totauxLabel}>Total HT :</Text>
            <Text style={s.totauxValue}>{totalHT.toFixed(2)} €</Text>
          </View>
          <View style={s.totauxRow}>
            <Text style={s.totauxLabel}></Text>
            <Text style={s.totauxLabel}>TVA :</Text>
            <Text style={s.totauxValue}>{(totalTTC - totalHT).toFixed(2)} €</Text>
          </View>
          <View style={s.totauxRow}>
            <Text style={s.totauxLabel}></Text>
            <Text style={s.totauxLabel}>Total TTC :</Text>
            <Text style={s.totauxValue}>{totalTTC.toFixed(2)} €</Text>
          </View>
          <View style={s.totauxRow}>
            <Text style={s.totauxLabel}></Text>
            <Text style={s.totauxNetLabel}>Net à payer :</Text>
            <Text style={s.totauxNetValue}>{totalTTC.toFixed(2)} €</Text>
          </View>
        </View>

        {/* Conditions de règlement */}
        <View style={s.conditionsBox}>
          <Text style={s.conditionsText}>
            Nature de l&apos;opération : Livraison de biens{'\n'}
            Conditions de règlement : {params.conditions_reglement} — Échéance : {echeance}
          </Text>
          {params.mention_article_441 && (
            <Text style={[s.conditionsText, { marginTop: 4 }]}>{params.mention_article_441}</Text>
          )}
        </View>

        {/* RIB/IBAN */}
        {params.iban && (
          <View style={s.ribBox}>
            <Text style={s.ribTitle}>Relevé d&apos;identité Bancaire</Text>
            <View style={s.ribRow}>
              <Text style={s.ribLabel}>IBAN :</Text>
              <Text style={s.ribValue}>{params.iban}</Text>
              <Text style={[s.ribLabel, { marginLeft: 16 }]}>BIC :</Text>
              <Text style={s.ribValue}>{params.bic}</Text>
            </View>
            {params.titulaire_iban && (
              <View style={s.ribRow}>
                <Text style={s.ribLabel}>Titulaire :</Text>
                <Text style={s.ribValue}>{params.titulaire_iban}</Text>
              </View>
            )}
          </View>
        )}

        {/* Mention réserve propriété */}
        {params.mention_reserve_propriete && (
          <Text style={s.mentionText}>{params.mention_reserve_propriete}</Text>
        )}

        {/* Pied de page */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{footerLine1}</Text>
          <Text style={s.footerText}>{footerLine2}</Text>
        </View>

      </Page>
    </Document>
  )
}
