/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { ParamsDocs, BLPDF } from './types'

// Polices PDF intégrées — aucun chargement réseau nécessaire

const GRAY  = '#555555'
const LGRAY = '#F4F4F4'

function makeStyles(green: string) {
  return StyleSheet.create({
    page:       { fontFamily: 'Helvetica', fontSize: 9, color: '#333', backgroundColor: '#fff' },

    // ── Bandeau supérieur coloré ──────────────────────────────────
    topBand:    { backgroundColor: green, height: 5 },

    // ── En-tête ──────────────────────────────────────────────────
    header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 28, paddingTop: 18, paddingBottom: 14 },
    headerLeft: { flex: 1, flexDirection: 'column' },
    logo:       { width: 110, height: 55, objectFit: 'contain', marginBottom: 8 },
    logoPlaceholder: { width: 0, height: 0 },
    companyName:{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: green, marginBottom: 2 },
    companyLine:{ fontSize: 8, color: GRAY, marginBottom: 1.5, lineHeight: 1.4 },
    companyActiv:{ fontSize: 7.5, color: '#888', fontFamily: 'Helvetica-Oblique', marginTop: 3 },

    // Bloc BL (droite)
    headerRight:{ alignItems: 'flex-end', minWidth: 120 },
    blBadge:    { backgroundColor: green, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },
    blBadgeText:{ fontSize: 8, color: '#fff', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1 },
    blNumero:   { fontSize: 22, fontFamily: 'Helvetica-Bold', color: green, marginBottom: 2 },
    blDate:     { fontSize: 8.5, color: GRAY },

    // ── Séparateur ───────────────────────────────────────────────
    sep:        { borderBottomWidth: 1, borderBottomColor: green, marginHorizontal: 28, marginBottom: 14 },

    // ── Corps ────────────────────────────────────────────────────
    body:       { paddingHorizontal: 28 },
    twoCol:     { flexDirection: 'row', gap: 12, marginBottom: 12 },
    clientBox:  { flex: 1, backgroundColor: LGRAY, borderRadius: 4, padding: 10 },
    clientLabel:{ fontSize: 7, color: green, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
    clientName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
    clientLine: { fontSize: 8, color: GRAY, marginBottom: 1.5 },

    livBox:     { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 4, padding: 10 },
    livLabel:   { fontSize: 7, color: GRAY, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
    livLine:    { fontSize: 8, color: GRAY, marginBottom: 1.5 },

    // ── Tableau produits ─────────────────────────────────────────
    tableHead:  { flexDirection: 'row', backgroundColor: green, borderRadius: 3, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 1 },
    thRef:      { width: 55, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#fff' },
    thDesig:    { flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#fff' },
    thQte:      { width: 36, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' },
    row:        { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8 },
    rowAlt:     { backgroundColor: LGRAY },
    tdRef:      { width: 55, fontSize: 8, color: '#999' },
    tdDesig:    { flex: 1, fontSize: 8.5 },
    tdQte:      { width: 36, fontSize: 8.5, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: green },
    rowDivider: { borderBottomWidth: 0.5, borderBottomColor: '#e8e8e8', marginHorizontal: 8 },

    // ── Pied de page fixe ────────────────────────────────────────
    footer:     { position: 'absolute', bottom: 0, left: 0, right: 0 },
    footerBand: { backgroundColor: green, height: 3 },
    footerBody: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: '#ddd', gap: 8 },
    footerLogo: { width: 28, height: 14, objectFit: 'contain', opacity: 0.7 },
    footerText: { flex: 1, fontSize: 6.5, color: '#aaa', lineHeight: 1.6 },
    pageNum:    { fontSize: 7, color: '#bbb', textAlign: 'right' },
  })
}

interface Props {
  bl: BLPDF
  params: ParamsDocs
}

export default function BLDocument({ bl, params }: Props): React.ReactElement<DocumentProps, any> {
  const green = params.couleur_principale || '#1B5E20'
  const s = makeStyles(green)

  const dateFormatee = new Date(bl.date_livraison).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })

  // Adresse d'exploitation sur le BL, siège en pied de page légal
  const adrBL  = params.adresse_exploitation  || params.adresse
  const cpBL   = params.code_postal_exploitation || params.code_postal
  const vilBL  = params.ville_exploitation   || params.ville

  const footerLegal = [
    `${params.nom} — ${params.adresse}, ${params.code_postal} ${params.ville.toUpperCase()}`,
    `SIRET : ${params.siret}  ·  TVA : ${params.tva_intra}  ·  RCS ${params.rcs}  ·  APE ${params.ape_naf}`,
    params.certification_bio ? `Certifié Agriculture Biologique : ${params.certification_bio}` : '',
  ].filter(Boolean).join('\n')

  return (
    <Document creator="GAEC Les Petites Herbes" producer="Petites Herbes App">
      <Page size="A4" style={s.page}>

        {/* Bandeau couleur haut */}
        <View style={s.topBand} fixed />

        {/* ── En-tête ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {params.logo_url
              ? <Image src={params.logo_url} style={s.logo} />
              : null
            }
            <Text style={s.companyName}>{params.nom}</Text>
            <Text style={s.companyLine}>{adrBL}</Text>
            <Text style={s.companyLine}>{cpBL} {vilBL}</Text>
            <Text style={s.companyLine}>Tél. {params.telephone}</Text>
            <Text style={s.companyLine}>{params.email}</Text>
            {params.activite ? <Text style={s.companyActiv}>{params.activite}</Text> : null}
          </View>

          <View style={s.headerRight}>
            <View style={s.blBadge}><Text style={s.blBadgeText}>Bon de livraison</Text></View>
            <Text style={s.blNumero}>N° {bl.numero}</Text>
            <Text style={s.blDate}>{dateFormatee}</Text>
          </View>
        </View>

        <View style={s.sep} />

        {/* ── Corps ── */}
        <View style={s.body}>

          {/* Destinataire + adresse livraison */}
          <View style={s.twoCol}>
            <View style={s.clientBox}>
              <Text style={s.clientLabel}>Destinataire</Text>
              <Text style={s.clientName}>{bl.client.nom}</Text>
              {bl.client.adresse ? <Text style={s.clientLine}>{bl.client.adresse}</Text> : null}
              {(bl.client.code_postal || bl.client.ville)
                ? <Text style={s.clientLine}>{bl.client.code_postal} {bl.client.ville}</Text>
                : null}
              <Text style={s.clientLine}>{bl.client.pays || 'FRANCE'}</Text>
              {bl.client.tva_intra ? <Text style={[s.clientLine, { marginTop: 3 }]}>TVA : {bl.client.tva_intra}</Text> : null}
              {bl.client.siret ? <Text style={s.clientLine}>SIRET : {bl.client.siret}</Text> : null}
            </View>

            <View style={s.livBox}>
              <Text style={s.livLabel}>Adresse de livraison</Text>
              <Text style={[s.livLine, { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#333' }]}>{bl.client.nom}</Text>
              {bl.client.adresse ? <Text style={s.livLine}>{bl.client.adresse}</Text> : null}
              {(bl.client.code_postal || bl.client.ville)
                ? <Text style={s.livLine}>{bl.client.code_postal} {bl.client.ville}</Text>
                : null}
            </View>
          </View>

          {/* Tableau produits */}
          <View style={s.tableHead}>
            <Text style={s.thRef}>Réf.</Text>
            <Text style={s.thDesig}>Désignation</Text>
            <Text style={s.thQte}>Qté</Text>
          </View>

          {bl.lignes.map((l, i) => (
            <View key={i}>
              <View style={[s.row, i % 2 !== 0 ? s.rowAlt : {}]}>
                <Text style={s.tdRef}>{l.reference || ''}</Text>
                <Text style={s.tdDesig}>{l.designation}</Text>
                <Text style={s.tdQte}>{l.quantite}</Text>
              </View>
              {i % 2 === 0 ? <View style={s.rowDivider} /> : null}
            </View>
          ))}
        </View>

        {/* ── Pied de page fixe ── */}
        <View style={s.footer} fixed>
          <View style={s.footerBody}>
            {params.logo_url
              ? <Image src={params.logo_url} style={s.footerLogo} />
              : null}
            <Text style={s.footerText}>{footerLegal}</Text>
            <Text style={s.pageNum} render={({ pageNumber, totalPages }) =>
              totalPages > 1 ? `${pageNumber} / ${totalPages}` : ''
            } />
          </View>
          <View style={s.footerBand} />
        </View>

      </Page>
    </Document>
  )
}
