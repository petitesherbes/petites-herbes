/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { ParamsDocs, BLPDF } from './types'

// Sur Vercel, les polices doivent être chargées via HTTP (pas filesystem)
function fontUrl(filename: string): string {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
  return `${base}/fonts/${filename}`
}

Font.register({
  family: 'Roboto',
  fonts: [
    { src: fontUrl('Roboto.ttf'), fontWeight: 'normal' },
    { src: fontUrl('Roboto.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
    { src: fontUrl('Roboto-Bold.ttf'), fontWeight: 'bold' },
    { src: fontUrl('Roboto-Bold.ttf'), fontWeight: 'bold', fontStyle: 'italic' },
  ],
})

const GREEN = '#1B5E20'
const LIGHT_GREEN = '#E8F5E9'
const GRAY = '#666666'
const LIGHT_GRAY = '#F5F5F5'

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
  clientBox:     { backgroundColor: LIGHT_GRAY, padding: 10, marginBottom: 10, borderRadius: 3 },
  clientName:    { fontSize: 9.5, fontWeight: 'bold', marginBottom: 2 },
  clientLine:    { fontSize: 8.5, color: GRAY, marginBottom: 1 },
  livLabel:      { fontSize: 7.5, color: '#999', marginBottom: 10 },
  tableHeader:   { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: '#222', paddingBottom: 4, marginBottom: 2 },
  thRef:         { width: 60, fontSize: 8, fontWeight: 'bold', color: GRAY },
  thDesig:       { flex: 1, fontSize: 8, fontWeight: 'bold', color: GRAY },
  thQte:         { width: 40, fontSize: 8, fontWeight: 'bold', color: GRAY, textAlign: 'right' },
  row:           { flexDirection: 'row', paddingVertical: 3.5 },
  rowAlt:        { backgroundColor: LIGHT_GRAY },
  tdRef:         { width: 60, fontSize: 8, color: '#999' },
  tdDesig:       { flex: 1, fontSize: 8.5 },
  tdQte:         { width: 40, fontSize: 8.5, fontWeight: 'bold', textAlign: 'right' },
  footer:        { position: 'absolute', bottom: 20, left: 30, right: 30, borderTopWidth: 0.5, borderTopColor: '#ccc', paddingTop: 6 },
  footerText:    { fontSize: 7, color: '#aaa', textAlign: 'center', lineHeight: 1.6 },
  logo:          { width: 60, height: 30, objectFit: 'contain', marginBottom: 4 },
})

interface Props {
  bl: BLPDF
  params: ParamsDocs
}

export default function BLDocument({ bl, params }: Props): React.ReactElement<DocumentProps, any> {
  const dateFormatee = new Date(bl.date_livraison).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit'
  })

  const ligneAdresse = [
    bl.client.adresse,
    [bl.client.code_postal, bl.client.ville].filter(Boolean).join(' '),
    bl.client.pays && bl.client.pays !== 'FRANCE' ? bl.client.pays : null,
  ].filter(Boolean).join(', ')

  const footerLine1 = `${params.nom} - ${params.adresse} - ${params.code_postal} ${params.ville.toUpperCase()}`
  const footerLine2 = `Au capital de ${params.capital}€ - RCS ${params.rcs} N°SIRET : ${params.siret} - TVA Intra. : ${params.tva_intra} - APE/NAF : ${params.ape_naf}${params.certification_bio ? `\n* Certifié par ${params.certification_bio}` : ''}`

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
            <Text style={s.docLabel}>Bon de livraison</Text>
            <Text style={s.docNumero}>N° {bl.numero}</Text>
            <Text style={s.docDate}>Le : {dateFormatee}</Text>
          </View>
        </View>

        <View style={s.separator} />

        {/* Bloc client */}
        <View style={s.clientBox}>
          <Text style={s.clientName}>{bl.client.nom}</Text>
          {bl.client.adresse && <Text style={s.clientLine}>{bl.client.adresse}</Text>}
          {(bl.client.code_postal || bl.client.ville) && (
            <Text style={s.clientLine}>{bl.client.code_postal} {bl.client.ville}</Text>
          )}
          <Text style={s.clientLine}>{bl.client.pays || 'FRANCE'}</Text>
          {bl.client.tva_intra && <Text style={[s.clientLine, { marginTop: 2 }]}>{bl.client.tva_intra}</Text>}
          {bl.client.siret && <Text style={s.clientLine}>{bl.client.siret}</Text>}
        </View>

        {/* Adresse de livraison */}
        <Text style={s.livLabel}>
          Adresse de livraison : {bl.client.nom} {ligneAdresse ? '· ' + ligneAdresse : ''}
        </Text>

        {/* Tableau */}
        <View style={s.tableHeader}>
          <Text style={s.thRef}>Réf.</Text>
          <Text style={s.thDesig}>Désignation</Text>
          <Text style={s.thQte}>Qté</Text>
        </View>

        {bl.lignes.map((l, i) => (
          <View key={i} style={[s.row, i % 2 !== 0 ? s.rowAlt : {}]}>
            <Text style={s.tdRef}>{l.reference || ''}</Text>
            <Text style={s.tdDesig}>{l.designation}</Text>
            <Text style={s.tdQte}>{l.quantite}</Text>
          </View>
        ))}

        {/* Pied de page fixe */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{footerLine1}</Text>
          <Text style={s.footerText}>{footerLine2}</Text>
        </View>

      </Page>
    </Document>
  )
}
