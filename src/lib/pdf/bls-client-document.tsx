/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import path from 'path'
import { ParamsDocs, BLPDF } from './types'

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Roboto',
  fonts: [
    { src: path.join(FONTS_DIR, 'Roboto.ttf'), fontWeight: 'normal' },
    { src: path.join(FONTS_DIR, 'Roboto-Bold.ttf'), fontWeight: 'bold' },
  ],
})

const GREEN = '#1B5E20'
const GRAY = '#666666'
const LIGHT_GRAY = '#F5F5F5'

const s = StyleSheet.create({
  page:         { padding: 30, fontSize: 9, fontFamily: 'Roboto', color: '#333' },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  headerLeft:   { flex: 1 },
  headerRight:  { alignItems: 'flex-end' },
  companyName:  { fontSize: 13, fontWeight: 'bold', color: GREEN, marginBottom: 3 },
  companyLine:  { fontSize: 8, color: GRAY, marginBottom: 1.5 },
  companyActiv: { fontSize: 7.5, color: '#888', fontStyle: 'italic', marginTop: 2 },
  docLabel:     { fontSize: 8, color: GRAY, textTransform: 'uppercase', letterSpacing: 1 },
  docNumero:    { fontSize: 16, fontWeight: 'bold', color: GREEN, marginTop: 2 },
  docDate:      { fontSize: 8, color: GRAY, marginTop: 2 },
  separator:    { borderBottomWidth: 1.5, borderBottomColor: GREEN, marginBottom: 12 },
  clientBox:    { backgroundColor: LIGHT_GRAY, padding: 8, marginBottom: 8, borderRadius: 3 },
  clientName:   { fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  clientLine:   { fontSize: 8, color: GRAY, marginBottom: 1 },
  livLabel:     { fontSize: 7, color: '#999', marginBottom: 8 },
  tableHeader:  { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: '#222', paddingBottom: 3, marginBottom: 2 },
  thRef:        { width: 55, fontSize: 7.5, fontWeight: 'bold', color: GRAY },
  thDesig:      { flex: 1, fontSize: 7.5, fontWeight: 'bold', color: GRAY },
  thQte:        { width: 35, fontSize: 7.5, fontWeight: 'bold', color: GRAY, textAlign: 'right' },
  row:          { flexDirection: 'row', paddingVertical: 3 },
  rowAlt:       { backgroundColor: LIGHT_GRAY },
  tdRef:        { width: 55, fontSize: 8, color: '#999' },
  tdDesig:      { flex: 1, fontSize: 8.5 },
  tdQte:        { width: 35, fontSize: 8.5, fontWeight: 'bold', textAlign: 'right' },
  footer:       { position: 'absolute', bottom: 20, left: 30, right: 30, borderTopWidth: 0.5, borderTopColor: '#ccc', paddingTop: 5 },
  footerText:   { fontSize: 6.5, color: '#aaa', textAlign: 'center', lineHeight: 1.5 },
  logo:         { width: 55, height: 28, objectFit: 'contain', marginBottom: 3 },
})

interface Props {
  bls: BLPDF[]
  params: ParamsDocs
}

export default function BLsClientDocument({ bls, params }: Props): React.ReactElement<DocumentProps, any> {
  if (bls.length === 0) return (
    <Document><Page size="A4" style={s.page}><Text>Aucun BL</Text></Page></Document>
  )

  const client = bls[0].client
  const footerLine1 = `${params.nom} - ${params.adresse} - ${params.code_postal} ${params.ville.toUpperCase()}`
  const footerLine2 = `SIRET : ${params.siret} - TVA Intra. : ${params.tva_intra} - APE/NAF : ${params.ape_naf}${params.certification_bio ? ` * Certifié par ${params.certification_bio}` : ''}`

  return (
    <Document creator="GAEC Les Petites Herbes" producer="Petites Herbes App">
      {bls.map((bl, blIdx) => {
        const dateFormatee = new Date(bl.date_livraison).toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', year: '2-digit'
        })

        return (
          <Page key={bl.id} size="A4" style={s.page}>
            {/* En-tête */}
            <View style={s.headerRow}>
              <View style={s.headerLeft}>
                {blIdx === 0 && params.logo_url && <Image src={params.logo_url} style={s.logo} />}
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
                <Text style={[s.docDate, { marginTop: 6, color: '#aaa', fontSize: 7 }]}>
                  {blIdx + 1}/{bls.length}
                </Text>
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
            </View>

            <Text style={s.livLabel}>
              Adresse de livraison : {client.nom}{client.adresse ? ' · ' + client.adresse : ''}{client.code_postal ? ' ' + client.code_postal : ''}{client.ville ? ' ' + client.ville : ''}
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

            {/* Pied de page */}
            <View style={s.footer} fixed>
              <Text style={s.footerText}>{footerLine1}</Text>
              <Text style={s.footerText}>{footerLine2}</Text>
            </View>
          </Page>
        )
      })}
    </Document>
  )
}
