'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { TempData } from '../../interfaces/tempData';
import { User, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import Link from "next/link"


const handleGoogleSignIn = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const userCredential = await signInWithPopup(auth, provider);
    console.log(userCredential.user);
  } catch (error) {
    console.error(error);
  }
};

const Dht22Page: React.FC = () => {
  const [deviceIds, setDeviceIds] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [deviceData, setDeviceData] = useState<TempData[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchDeviceIds = async () => {
      try {
        const tempCollectionRef = collection(db, 'DHT22');
        const tempSnapshots = await getDocs(tempCollectionRef);
        const ids = tempSnapshots.docs.map((doc) => doc.id);
        setDeviceIds(ids);
      } catch (error) {
        console.error(error);
      }
    };
    fetchDeviceIds();
  }, [user]);

  const handleFilter = async () => {
    if (!selectedDevice || !startDate || !endDate) return;
    try {
      const dataRef = collection(db, 'DHT22', selectedDevice, 'Data');
      const s = new Date(startDate);
      const e = new Date(endDate);
      const qRef = query(
        dataRef,
        where('date_time', '>=', s),
        where('date_time', '<=', e),
        orderBy('date_time', 'asc')
      );
      const snapshot = await getDocs(qRef);
      const dataArray = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date_time: (data.date_time as Timestamp).toDate(),
        } as TempData;
      });
      setDeviceData(dataArray);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h1 className="text-2xl font-semibold mb-4">Please Sign In</h1>
        <button onClick={handleGoogleSignIn} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Sign In with Google
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/">
        <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Home
        </button>
      </Link>

      <h1 className="text-3xl font-bold text-center mb-6">DHT22 Data</h1>
      <div className="mb-4">
        <label className="mr-2">Device:</label>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="p-1 border rounded mr-4"
        >
          <option value="">-- Choose --</option>
          {deviceIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <label className="mr-2">Start:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="p-1 border rounded mr-4"
        />
        <label className="mr-2">End:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="p-1 border rounded mr-4"
        />
        <button onClick={handleFilter} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Filter
        </button>
      </div>
      {deviceData.length > 0 && (
        <div className="border border-gray-300 rounded-lg p-4">
          <h2 className="text-2xl font-semibold mb-4">Device: {selectedDevice}</h2>
          {deviceData.map((data) => (
            <div key={data.id} className="bg-gray-100 p-4 mb-4 rounded-lg">
              <h3 className="text-xl font-medium mb-2">Entry {data.id}</h3>
              <p className="text-gray-700">Date Time: {data.date_time.toLocaleString()}</p>
              <p className="text-gray-700">Humidity: {data.Humidity}%</p>
              <p className="text-gray-700">Temperature: {data.Temperature}°C</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dht22Page;
