'use client'

import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface LocationMapProps {
  center: [number, number]
  zoom?: number
  markers?: Array<{
    position: [number, number]
    popup: string
  }>
  className?: string
}

export default function LocationMap({
  center,
  zoom = 13,
  markers = [],
  className = "h-64 w-full"
}: LocationMapProps) {
  useEffect(() => {
    // Ensure the map resizes properly
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, 100)
    return () => clearTimeout(timer)
  }, [])


  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full rounded-lg"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers.map((marker, index) => (
          <Marker key={index} position={marker.position}>
            <Popup>{marker.popup}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}