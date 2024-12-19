"use client";

import React, { useEffect, useState } from 'react';
import { getDownloadURL, listAll, ref, getMetadata } from 'firebase/storage';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { storage, auth, db } from '../../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { SoilData } from '../../interfaces/soilData';
import { TempData } from '../../interfaces/tempData';

interface ImageData {
  type: 'image';
  id: string;
  url: string;
  createdAt: Date;
}

interface SensorData {
  type: 'sensor';
  id: string;
  source: 'Soil' | 'DHT22';
  data: SoilData | TempData;
  createdAt: Date;
}

type CombinedData = ImageData | SensorData;

export default function CombinedDataPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupedData, setGroupedData] = useState<Map<string, { images: string[]; soilAvg: any; dhtAvg: any }>>(new Map());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [groupsPerDay, setGroupsPerDay] = useState<number>(2);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  const handleFetchData = async () => {
    if (!startDate || !endDate || groupsPerDay <= 0) {
      alert('Please select valid start and end dates and a positive number of groups per day.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    // Calculate the interval: if user selects 2, that means 24 / 2 = 12 hours per group.
    const intervalInMs = (24 / groupsPerDay) * 60 * 60 * 1000;
    const data: CombinedData[] = [];

    try {
      const imagesRef = ref(storage, '');
      const imageList = await listAll(imagesRef);
      const imageData: ImageData[] = (await Promise.all(
        imageList.items.map(async (item) => {
          const url = await getDownloadURL(item);
          const metadata = await getMetadata(item);
          const createdAt = new Date(metadata.timeCreated);
          if (createdAt >= start && createdAt <= end) {
            return { type: 'image', id: item.name, url, createdAt };
          }
          return null;
        })
      )).filter((item): item is ImageData => item !== null);
      data.push(...imageData);
    } catch (error) {
      console.error('Error fetching images:', error);
    }

    const fetchSensorData = async (collectionName: string, source: 'Soil' | 'DHT22') => {
      const snapshots = await getDocs(collection(db, collectionName));
      for (const doc of snapshots.docs) {
        const sensorDataSnapshots = await getDocs(collection(db, collectionName, doc.id, 'Data'));
        sensorDataSnapshots.docs.forEach((doc) => {
          const docData = doc.data();
          const createdAt = (docData.date_time as Timestamp).toDate();
          if (createdAt >= start && createdAt <= end) {
            if (source === 'Soil') {
              const soilData: SoilData = {
                id: doc.id,
                date_time: createdAt,
                EC: docData.EC,
                Humidity: docData.Humidity,
                Moisture: docData.Moisture,
                Nitrogen: docData.Nitrogen,
                pH: docData.pH,
                Phosphorus: docData.Phosphorus,
                Potassium: docData.Potassium,
                Temperature: docData.Temperature
              };
              data.push({ type: 'sensor', id: doc.id, source, data: soilData, createdAt });
            } else {
              const tempData: TempData = {
                id: doc.id,
                date_time: createdAt,
                Humidity: docData.Humidity,
                Temperature: docData.Temperature
              };
              data.push({ type: 'sensor', id: doc.id, source, data: tempData, createdAt });
            }
          }
        });
      }
    };

    await fetchSensorData('Soil', 'Soil');
    await fetchSensorData('DHT22', 'DHT22');

    const grouped = new Map<string, { images: string[]; soil: any[]; dht: any[] }>();

    data.forEach((item) => {
      const groupKey = Math.floor((item.createdAt.getTime() - start.getTime()) / intervalInMs) * intervalInMs + start.getTime();
      const groupTime = new Date(groupKey).toLocaleString();

      if (!grouped.has(groupTime)) {
        grouped.set(groupTime, { images: [], soil: [], dht: [] });
      }

      const group = grouped.get(groupTime)!;
      if (item.type === 'image') {
        group.images.push((item as ImageData).url);
      } else if (item.type === 'sensor' && item.source === 'Soil') {
        group.soil.push(item.data);
      } else if (item.type === 'sensor' && item.source === 'DHT22') {
        group.dht.push(item.data);
      }
    });

    const avg = (dataArr: any[], fields: string[]) =>
      dataArr.length > 0
        ? fields.reduce((acc, field) => {
            acc[field] = dataArr.reduce((sum, item) => sum + (item[field] || 0), 0) / dataArr.length;
            return acc;
          }, {} as any)
        : null;

    const averagedData = new Map<string, { images: string[]; soilAvg: any; dhtAvg: any }>();
    grouped.forEach((value, key) => {
      averagedData.set(key, {
        images: value.images,
        soilAvg: avg(value.soil, ['EC', 'Humidity', 'Moisture', 'Nitrogen', 'pH', 'Phosphorus', 'Potassium', 'Temperature']),
        dhtAvg: avg(value.dht, ['Humidity', 'Temperature']),
      });
    });

    setGroupedData(averagedData);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">All Data</h1>
      <div className="mb-6 flex space-x-4">
        <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded px-4 py-2" />
        <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded px-4 py-2" />
        <input
          type="number"
          min="1"
          value={groupsPerDay}
          onChange={(e) => setGroupsPerDay(parseInt(e.target.value))}
          className="border rounded px-4 py-2"
          placeholder="Groups per day"
        />
        <button onClick={handleFetchData} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
          Fetch Data
        </button>
      </div>

      <table className="table-auto w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border px-4 py-2">Time Group</th>
            <th className="border px-4 py-2">Images</th>
            <th className="border px-4 py-2">Soil Average</th>
            <th className="border px-4 py-2">DHT22 Average</th>
          </tr>
        </thead>
        <tbody>
          {[...groupedData.entries()].map(([time, { images, soilAvg, dhtAvg }]) => (
            <tr key={time}>
              <td className="border px-4 py-2">{time}</td>
              <td className="border px-4 py-2">
                {images.map((url, index) => (
                  <img key={index} src={url} alt="Image" className="h-16 inline-block" />
                ))}
              </td>
              <td className="border px-4 py-2">{soilAvg ? JSON.stringify(soilAvg, null, 2) : 'No Data'}</td>
              <td className="border px-4 py-2">{dhtAvg ? JSON.stringify(dhtAvg, null, 2) : 'No Data'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
