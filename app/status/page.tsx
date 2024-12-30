"use client"
import { useEffect, useState, useCallback } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { User, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth'

interface Device {
    id: string
    active?: boolean
}

const deviceTypes = ['Camera', 'DHT22', 'Soil']

const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider()
    try {
        await signInWithPopup(auth, provider)
    } catch (error) {
        console.error('Error with Google Sign-In:', error)
    }
}

export default function DeviceStatusPage() {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [deviceType, setDeviceType] = useState('Camera')
    const [devices, setDevices] = useState<Device[]>([])
    
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser)
            setLoading(false)
        })
        return () => unsubscribeAuth()
    }, [])

    useEffect(() => {
        if (!user) return

        const fetchData = async () => {
            try {
                const colRef = collection(db, deviceType)
                const snapshot = await getDocs(colRef)
                const deviceData: Device[] = snapshot.docs.map((doc) => {
                    const data = doc.data() as Device
                    if (!data.id) {
                      data.id = doc.id; // Assign the Firestore id only if it doesn't exist in the document
                    }
                    return data;
                  });
                  
                setDevices(deviceData)
            } catch (error) {
                console.error('Error fetching devices:', error)
            }
        }

        fetchData()
    }, [deviceType, user]) // Only fetch data if deviceType or user changes

    const handleDeviceTypeChange = useCallback((type: string) => {
        if (deviceType !== type) {
            setDeviceType(type)
        }
    }, [deviceType])

    if (loading) {
        return <div className="flex items-center justify-center h-screen text-xl">Loading...</div>
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-screen space-y-4">
                <h1 className="text-3xl font-bold">Please Sign In</h1>
                <button
                    onClick={handleGoogleSignIn}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
                >
                    Sign In with Google
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-screen p-6 max-w-4xl mx-auto">
            <nav className="flex justify-between items-center mb-6">
                <div className="flex space-x-4">
                    {deviceTypes.map((type) => (
                        <button
                            key={type}
                            onClick={() => handleDeviceTypeChange(type)}
                            className={`px-4 py-2 rounded ${deviceType === type ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
                                } hover:bg-blue-500 hover:text-white`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => auth.signOut()}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500"
                >
                    Sign Out
                </button>
            </nav>
            <h1 className="text-3xl font-bold mb-4">{deviceType} Status</h1>
            {devices.length === 0 ? (
                <div className="text-center text-gray-600">No devices found</div>
            ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {devices.map((device: Device) => (
                        <li
                            key={device.id} // Ensure each child has a unique key
                            className="border border-gray-300 rounded-lg p-4 bg-white shadow"
                        >
                            <h2 className="text-xl font-semibold mb-2">{device.id}</h2>
                            <p
                                className={`text-lg font-medium ${device.active ? 'text-green-600' : 'text-red-600'
                                    }`}
                            >
                                {device.active ? 'Online' : 'Offline'}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
