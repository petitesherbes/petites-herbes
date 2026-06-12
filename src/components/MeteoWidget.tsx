'use client'
import { useEffect, useRef, useState } from 'react'

type MeteoJour = {
  date: string; code: number
  tmax: number; tmin: number
  pluie: number; pluie_proba: number
  vent: number; rafales: number; vent_dir: number
  soleil_h: number; uv: number; etp: number
}

type MeteoHeure = {
  heure: string; code: number
  temp: number; pluie_proba: number; pluie: number
  vent: number; humidite: number; uv: number
}

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

function dirVent(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return dirs[Math.round(deg / 45) % 8]
}

function alertesAgri(j: MeteoJour): string[] {
  const a: string[] = []
  if (j.tmin <= 2)         a.push(`Risque gel (${j.tmin}°C)`)
  if (j.rafales >= 50)     a.push(`Rafales fortes (${j.rafales} km/h)`)
  if (j.pluie >= 20)       a.push(`Fortes pluies (${j.pluie} mm)`)
  if (j.tmax >= 35)        a.push(`Chaleur extreme (${j.tmax}°C)`)
  if (j.etp >= 6)          a.push(`Besoin eau eleve (ETP ${j.etp} mm)`)
  return a
}

const JOURS_COURT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

function uvCouleur(uv: number): string {
  if (uv <= 2)  return 'text-green-600'
  if (uv <= 5)  return 'text-yellow-600'
  if (uv <= 7)  return 'text-orange-600'
  return 'text-red-600'
}

export default function MeteoWidget() {
  const [jours, setJours]   = useState<MeteoJour[]>([])
  const [heures, setHeures] = useState<MeteoHeure[]>([])
  const [detail, setDetail] = useState(false)
  const [erreur, setErreur] = useState(false)
  const [charge, setCharge] = useState(true)
  const scrollRef           = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const lat = typeof window !== 'undefined' ? (localStorage.getItem('meteo_lat') || '43.95') : '43.95'
    const lon = typeof window !== 'undefined' ? (localStorage.getItem('meteo_lon') || '4.81')  : '4.81'

    if (typeof window !== 'undefined' && !localStorage.getItem('meteo_lat') && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        localStorage.setItem('meteo_lat', String(pos.coords.latitude.toFixed(4)))
        localStorage.setItem('meteo_lon', String(pos.coords.longitude.toFixed(4)))
      })
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,` +
      `windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant,sunshine_duration,et0_fao_evapotranspiration,uv_index_max` +
      `&hourly=temperature_2m,precipitation_probability,precipitation,windspeed_10m,relative_humidity_2m,weathercode,uv_index` +
      `&timezone=Europe%2FParis&forecast_days=7`

    fetch(url)
      .then(r => r.json())
      .then(d => {
        const daily = d.daily
        const j: MeteoJour[] = (daily.time as string[]).map((date, i) => ({
          date,   code: daily.weathercode[i],
          tmax:   Math.round(daily.temperature_2m_max[i]),
          tmin:   Math.round(daily.temperature_2m_min[i]),
          pluie:  Math.round((daily.precipitation_sum[i] || 0) * 10) / 10,
          pluie_proba: daily.precipitation_probability_max[i] || 0,
          vent:   Math.round(daily.windspeed_10m_max[i] || 0),
          rafales: Math.round(daily.windgusts_10m_max[i] || 0),
          vent_dir: Math.round(daily.winddirection_10m_dominant[i] || 0),
          soleil_h: Math.round((daily.sunshine_duration[i] || 0) / 360) / 10,
          uv:     Math.round(daily.uv_index_max[i] || 0),
          etp:    Math.round((daily.et0_fao_evapotranspiration[i] || 0) * 10) / 10,
        }))
        setJours(j)

        const today = daily.time[0]
        const hourly = d.hourly
        const hh: MeteoHeure[] = []
        ;(hourly.time as string[]).forEach((t: string, i: number) => {
          if (!t.startsWith(today)) return
          hh.push({
            heure:       t.slice(11, 16),
            code:        hourly.weathercode[i],
            temp:        Math.round(hourly.temperature_2m[i]),
            pluie_proba: hourly.precipitation_probability[i] || 0,
            pluie:       Math.round((hourly.precipitation[i] || 0) * 10) / 10,
            vent:        Math.round(hourly.windspeed_10m[i] || 0),
            humidite:    hourly.relative_humidity_2m[i] || 0,
            uv:          Math.round(hourly.uv_index[i] || 0),
          })
        })
        setHeures(hh)
      })
      .catch(() => setErreur(true))
      .finally(() => setCharge(false))
  }, [])

  // Scroll vers l'heure actuelle au chargement
  useEffect(() => {
    if (heures.length > 0 && scrollRef.current && detail) {
      const heureNow = new Date().getHours()
      const idx = Math.max(0, heureNow - 1)
      const child = scrollRef.current.children[idx] as HTMLElement
      if (child) child.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    }
  }, [heures, detail])

  if (charge) return (
    <div className="bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3 text-sky-400 text-sm animate-pulse">
      Chargement météo…
    </div>
  )

  if (erreur || jours.length === 0) return null

  const auj   = jours[0]
  const suite = jours.slice(1)
  const [emojiAuj, labelAuj] = decodeCode(auj.code)
  const alertes = alertesAgri(auj)
  const heureNowStr = `${String(new Date().getHours()).padStart(2, '0')}:00`

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-2xl overflow-hidden">

      {/* En-tête aujourd'hui — cliquable pour detail */}
      <button className="w-full text-left px-4 pt-3 pb-2 flex items-start justify-between active:bg-sky-100 transition-colors"
        onClick={() => setDetail(v => !v)}>
        <div className="flex items-center gap-3">
          <span className="text-4xl leading-none">{emojiAuj}</span>
          <div>
            <div className="font-bold text-sky-900 text-base">{labelAuj}</div>
            <div className="text-sky-700 text-xs mt-0.5">
              {auj.tmax}° / {auj.tmin}°
              {auj.pluie > 0 && <span className="ml-2">💧 {auj.pluie} mm ({auj.pluie_proba}%)</span>}
              {auj.vent > 10 && <span className="ml-2">💨 {auj.vent} km/h {dirVent(auj.vent_dir)}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 pt-0.5">
          <span className="text-sky-400 text-xs">{detail ? '▲ Réduire' : '▼ Détail'}</span>
          <span className="text-sky-400 text-[10px]">Open-Meteo</span>
        </div>
      </button>

      {/* Alertes agricoles */}
      {alertes.length > 0 && (
        <div className="mx-3 mb-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 space-y-0.5">
          {alertes.map((a, i) => (
            <div key={i} className="text-amber-800 text-xs font-semibold">⚠ {a}</div>
          ))}
        </div>
      )}

      {/* Panneau détail aujourd'hui */}
      {detail && (
        <div className="border-t border-sky-100">
          {/* Grille de détails */}
          <div className="px-3 pt-2.5 pb-1 grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] text-sky-500 font-semibold">Rafales</div>
              <div className="text-sm font-bold text-sky-800">{auj.rafales} km/h</div>
              <div className="text-[10px] text-sky-400">{dirVent(auj.vent_dir)}</div>
            </div>
            <div className="bg-white rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] text-sky-500 font-semibold">Soleil</div>
              <div className="text-sm font-bold text-sky-800">{auj.soleil_h} h</div>
              <div className="text-[10px] text-sky-400">aujourd'hui</div>
            </div>
            <div className="bg-white rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] text-sky-500 font-semibold">UV max</div>
              <div className={`text-sm font-bold ${uvCouleur(auj.uv)}`}>{auj.uv}</div>
              <div className="text-[10px] text-sky-400">
                {auj.uv <= 2 ? 'faible' : auj.uv <= 5 ? 'modere' : auj.uv <= 7 ? 'eleve' : 'tres eleve'}
              </div>
            </div>
            <div className="bg-white rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] text-sky-500 font-semibold">Pluie proba</div>
              <div className="text-sm font-bold text-sky-800">{auj.pluie_proba}%</div>
              <div className="text-[10px] text-sky-400">{auj.pluie > 0 ? `${auj.pluie} mm` : 'sec'}</div>
            </div>
            <div className="bg-white rounded-xl px-3 py-2 text-center col-span-2">
              <div className="text-[10px] text-sky-500 font-semibold">ETP (evapotranspiration)</div>
              <div className="text-sm font-bold text-green-700">{auj.etp} mm</div>
              <div className="text-[10px] text-sky-400">
                {auj.etp < 2 ? 'besoin eau faible' : auj.etp < 4 ? 'besoin eau modere' : auj.etp < 6 ? 'arroser ce soir' : 'arrosage urgent'}
              </div>
            </div>
          </div>

          {/* Courbe horaire */}
          {heures.length > 0 && (
            <div className="px-3 pb-2.5">
              <div className="text-[10px] font-semibold text-sky-500 mb-1.5">Heure par heure</div>
              <div ref={scrollRef}
                className="flex gap-2 overflow-x-auto pb-1"
                style={{ scrollbarWidth: 'none' }}>
                {heures.map(h => {
                  const [em] = decodeCode(h.code)
                  const estNow = h.heure === heureNowStr
                  return (
                    <div key={h.heure}
                      className={`flex-none flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl min-w-[52px]
                        ${estNow ? 'bg-sky-200 border border-sky-400' : 'bg-white'}`}>
                      <span className="text-[10px] font-bold text-sky-500">{h.heure}</span>
                      <span className="text-base leading-none">{em}</span>
                      <span className="text-xs font-bold text-sky-800">{h.temp}°</span>
                      {h.pluie_proba > 0 && (
                        <span className="text-[9px] text-blue-500 font-semibold">{h.pluie_proba}%</span>
                      )}
                      <span className="text-[9px] text-sky-400">{h.vent}km</span>
                      <span className="text-[9px] text-gray-400">{h.humidite}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previsions 6 jours */}
      <div className="border-t border-sky-100 px-3 py-2 grid grid-cols-6 gap-1">
        {suite.map(j => {
          const [em] = decodeCode(j.code)
          const d = new Date(j.date + 'T12:00:00')
          return (
            <div key={j.date} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-sky-500 font-medium capitalize">{JOURS_COURT[d.getDay()]}</span>
              <span className="text-base leading-none">{em}</span>
              <span className="text-[10px] font-bold text-sky-800">{j.tmax}°</span>
              <span className="text-[9px] text-sky-400">{j.tmin}°</span>
              {j.pluie_proba > 20 && (
                <span className="text-[9px] text-blue-500 font-semibold">{j.pluie_proba}%</span>
              )}
              {j.rafales >= 40 && (
                <span className="text-[9px] text-gray-400">{j.rafales}↑</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
