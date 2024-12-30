"use client"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-center mb-10">Home</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/alldata">
          <div className="bg-white shadow-md rounded p-6 hover:bg-gray-50 transition">
            <h2 className="text-xl font-semibold mb-2">All Data</h2>
            <p className="text-gray-600">View all data records</p>
          </div>
        </Link>
        <Link href="/analysis">
          <div className="bg-white shadow-md rounded p-6 hover:bg-gray-50 transition">
            <h2 className="text-xl font-semibold mb-2">Analysis</h2>
            <p className="text-gray-600">Perform data analysis</p>
          </div>
        </Link>
        <Link href="/config">
          <div className="bg-white shadow-md rounded p-6 hover:bg-gray-50 transition">
            <h2 className="text-xl font-semibold mb-2">Config</h2>
            <p className="text-gray-600">Adjust system configurations</p>
          </div>
        </Link>
        <Link href="/dht22">
          <div className="bg-white shadow-md rounded p-6 hover:bg-gray-50 transition">
            <h2 className="text-xl font-semibold mb-2">DHT22</h2>
            <p className="text-gray-600">Temperature and humidity data</p>
          </div>
        </Link>
        <Link href="/image">
          <div className="bg-white shadow-md rounded p-6 hover:bg-gray-50 transition">
            <h2 className="text-xl font-semibold mb-2">Image Equalization</h2>
            <p className="text-gray-600">Image equalization</p>
          </div>
        </Link>
        <Link href="/soil">
          <div className="bg-white shadow-md rounded p-6 hover:bg-gray-50 transition">
            <h2 className="text-xl font-semibold mb-2">Soil</h2>
            <p className="text-gray-600">Soil moisture and nutrients</p>
          </div>
        </Link>
        <Link href="/status">
          <div className="bg-white shadow-md rounded p-6 hover:bg-gray-50 transition">
            <h2 className="text-xl font-semibold mb-2">Status</h2>
            <p className="text-gray-600">System status and logs</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
