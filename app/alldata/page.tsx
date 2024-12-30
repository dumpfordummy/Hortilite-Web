"use client";

import React, { useEffect, useState } from 'react';
import { getDownloadURL, listAll, ref } from 'firebase/storage';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { storage, auth, db } from '../../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { SoilData } from '../../interfaces/soilData';
import { TempData } from '../../interfaces/tempData';
import Link from "next/link"


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
  const [availableSets, setAvailableSets] = useState<string[]>([]);
  const [selectedSet, setSelectedSet] = useState<string>('');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    const fetchAvailableSets = async () => {
      const cameraSnapshots = await getDocs(collection(db, "Camera"));
      const sets = cameraSnapshots.docs.map((doc) => doc.id.split(".").pop());
      setAvailableSets(sets.filter((set): set is string => !!set));
    };

    fetchAvailableSets();
    return () => unsubscribeAuth();
  }, []);

  const handleFetchData = async () => {
    console.log('Fetch button clicked');
    console.log({ startDate, endDate, groupsPerDay, selectedSet });

    if (!startDate || !endDate || groupsPerDay <= 0 || !selectedSet) {
      alert('Please select valid start/end dates, groups per day, and a set.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const intervalInMs = (24 / groupsPerDay) * 60 * 60 * 1000;
    const data: CombinedData[] = [];

    try {
      const cameraIp = `192_168_1_${selectedSet}`;
      console.log('Fetching images for camera IP:', cameraIp);
      const listRef = ref(storage, '');
      const res = await listAll(listRef);

      const imageData: ImageData[] = (await Promise.all(
        res.items.map(async (itemRef) => {
          const fileName = itemRef.name;
          const [ip1, ip2, ip3, ip4, date, time] = fileName.split('_');
          const ip = `${ip1}_${ip2}_${ip3}_${ip4}`;
          const year = date.substring(0, 4);
          const month = date.substring(4, 6);
          const day = date.substring(6, 8);
          const hour = time.substring(0, 2);
          const minute = time.substring(2, 4);
          const second = time.substring(4, 6);

          // Match only files for the selected camera IP
          if (ip !== cameraIp) return null;

          const fileDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
          if (fileDate >= start && fileDate <= end) {
            const url = await getDownloadURL(itemRef);
            return { type: 'image', id: fileName, url, createdAt: fileDate };
          }
          return null;
        })
      )).filter((item): item is ImageData => item !== null);

      console.log('Images added:', imageData.length);
      data.push(...imageData);
    } catch (error) {
      console.error('Error fetching images:', error);
    }

    const fetchSensorData = async (collectionName: string, source: 'Soil' | 'DHT22') => {
      try {
        const sensorDocId =
          source === 'Soil'
            ? `soil_${selectedSet.slice(-2).padStart(2, '0')}`
            : `dht22_${selectedSet.slice(-1)}`;
        console.log(`${source} Path:`, `${collectionName}/${sensorDocId}/Data`);
        const sensorSnapshots = await getDocs(collection(db, collectionName, sensorDocId, 'Data'));
        sensorSnapshots.docs.forEach((doc) => {
          const docData = doc.data();
          const createdAt = (docData.date_time as Timestamp).toDate();
          if (createdAt >= start && createdAt <= end) {
            if (source === 'Soil') {
              const soilData: SoilData = {
                id: doc.id,
                date_time: createdAt,
                EC: docData.EC || 0,
                Humidity: docData.Humidity || 0,
                Moisture: docData.Moisture || 0,
                Nitrogen: docData.Nitrogen || 0,
                pH: docData.pH || 7,
                Phosphorus: docData.Phosphorus || 0,
                Potassium: docData.Potassium || 0,
                Temperature: docData.Temperature || 0,
              };
              data.push({ type: 'sensor', id: doc.id, source, data: soilData, createdAt });
            } else {
              const tempData: TempData = {
                id: doc.id,
                date_time: createdAt,
                Humidity: docData.Humidity || 0,
                Temperature: docData.Temperature || 0,
              };
              data.push({ type: 'sensor', id: doc.id, source, data: tempData, createdAt });
            }
          }
        });
        console.log(`${source} data fetched:`, sensorSnapshots.docs.length);
      } catch (error) {
        console.error(`Error fetching ${source} data:`, error);
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
      <Link href="/">
        <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Home
        </button>
      </Link>

      <h1 className="text-3xl font-bold text-center mb-6">Data by Set</h1>
      <div className="mb-6 flex space-x-4">
        <select
          value={selectedSet}
          onChange={(e) => setSelectedSet(e.target.value)}
          className="border rounded px-4 py-2"
        >
          <option value="">Select Set</option>
          {availableSets.map((set) => (
            <option key={set} value={set}>
              Set {set}
            </option>
          ))}
        </select>
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
