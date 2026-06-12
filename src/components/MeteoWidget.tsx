'use client'
import { useEffect, useState } from 'react'

type MeteoJour = {
  date: string
  code: number
  tmax: number
  tmin: number
  pluie: number   // mm
  vent: number    // km/h
}

// WMO weather interpretation codes → emoji + label
function decodeCode(code: number): [string, string] {
  if (code === 0)  return ['☀️', 'Ensoleillé']
  if (code <= 2)   return ['🌤️', 'Peu nuageux']
  if (code <= 3)   return ['⛅', 'Nuageux']
  if (code <= 48)  return ['🌫️', 'Brouillard']
  if (code <= 57)  return ['🌦️', 'Bruine']
  if (code <= 67)  return ['🌧️', 'Pluie']
  if (code <= 77)  return ['🌨️', 'Neige']
  if (code <= 82)  return ['🌦️', 'Averses']
  return ['⛈️', 'Orage']
}

function alertesAgri(jour: MeteoJour): string[] {
  const a: string[] = []
  if (jour.tmin <= 2)   a.push(`❄️ Risque gel (${jour.tmin}°C)`)
  if (jour.vent >= 40)  a.push(`💨 Vent fort (${jour.vent} km/h)`)
  if (jour.pluie >= 20) a.push(`🌊 Fortes pluies (${jour.pluie} mm)`)
  if (jour.tmax >= 35)  a.push(`🌡️ Chaleur extrême (${jour.tmax}°C)`)
  return a
}

const JOURS_COURT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

export default function MeteoWidget() {
  const [jours, setJours] = useState<MeteoJour[]>([])
  const [erreur, setErreur] = useState(false)
  const [charge, setCharge] = useState(true)

  useEffect(() => {
    // Coordonnées sauvegardées ou par défaut : Avignon (centre Provence-PACA)
    const lat = localStorage.getItem('meteo_lat') || '43.95'
    const lon = localStorage.getItem('meteo_lon') || '4.81'

    // Essayer de récupérer la géolocalisation une fois
    if (!localStorage.getItem('meteo_lat') && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        localStorage.setItem('meteo_lat', String(pos.coords.latitude.toFixed(4)))
        localStorage.setItem('meteo_lon', String(pos.coords.longitude.toFixed(4)))
      })
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max` +
      `&timezone=Europe%2FParis&forecast_days=7`

    fetch(url)
      .then(r => r.json())
      .then(d => {
        const daily = d.daily
        const j: MeteoJour[] = (daily.time as string[]).map((date, i) => ({
          date,
          code:  daily.weathercode[i],
          tmax:  Math.round(daily.temperature_2m_max[i]),
          tmin:  Math.round(daily.temperature_2m_min[i]),
          pluie: Math.round(daily.precipitation_sum[i] || 0),
          vent:  Math.round(daily.windspeed_10m_max[i] || 0),
        }))
        setJours(j)
      })
      .catch(() => setErreur(true))
      .finally(() => setCharge(false))
  }, [])

  if (charge) return (
    <div className="bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3 text-sky-400 text-sm animate-pulse">
      Chargement météo…
    </div>
  )

  if (erreur || jours.length === 0) return null

  const auj = jours[0]
  const suite = jours.slice(1)
  const [emojiAuj, labelAuj] = decodeCode(auj.code)
  const alertes = alertesAgri(auj)

  return (
    <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-2xl overflow-hidden">
      {/* Aujourd'hui */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl leading-none">{emojiAuj}</span>
          <div>
            <div className="font-bold text-sky-900 text-sm">{labelAuj}</div>
            <div className="text-sky-700 text-xs mt-0.5">
              {auj.tmax}° / {auj.tmin}°
              {auj.pluie > 0 && <span className="ml-2">💧 {auj.pluie} mm</span>}
              {auj.vent > 20 && <span className="ml-2">💨 {auj.vent} km/h</span>}
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-sky-500">Météo 7j</div>
      </div>

      {/* Alertes agricoles */}
      {alertes.length > 0 && (
        <div className="mx-3 mb-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 space-y-0.5">
          {alertes.map((a, i) => (
            <div key={i} className="text-amber-800 text-xs font-semibold">{a}</div>
          ))}
        </div>
      )}

      {/* Prévisions 6 jours suivants */}
      <div className="border-t border-sky-100 px-3 py-2 grid grid-cols-6 gap-1">
        {suite.map(j => {
          const [em] = decodeCode(j.code)
          const d = new Date(j.date + 'T12:00:00')
          return (
            <div key={j.date} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-sky-500 font-medium">{JOURS_COURT[d.getDay()]}</span>
              <span className="text-base leading-none">{em}</span>
              <span className="text-[10px] font-bold text-sky-800">{j.tmax}°</span>
              <span className="text-[9px] text-sky-400">{j.tmin}°</span>
              {j.pluie > 0 && <span className="text-[9px] text-blue-400">💧</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
