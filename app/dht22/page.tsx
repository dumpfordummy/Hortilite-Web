// app/dht22/page.tsx

'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import {
  auth,
  db,
} from '../../lib/firebase';
import { TempData } from '../../interfaces/tempData';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from 'firebase/auth';

const handleGoogleSignIn = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const userCredential = await signInWithPopup(auth, provider);
    console.log('Google Sign-In successful:', userCredential.user);
  } catch (error) {
    console.error('Error with Google Sign-In:', error);
  }
};

const Dht22Page: React.FC = () => {
  const [tempDataMap, setTempDataMap] = useState<Record<string, TempData[]>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Authentication
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        console.log('User signed in:', currentUser);
      } else {
        setUser(null);
        console.log('No user signed in');
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Fetch Temp Data
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const tempCollectionRef = collection(db, 'DHT22');
        const tempSnapshots = await getDocs(tempCollectionRef);

        const dataPromises = tempSnapshots.docs.map(async (tempDoc) => {
          const tempId = tempDoc.id;
          const dataCollectionRef = collection(db, 'DHT22', tempId, 'Data');
          const dataSnapshots = await getDocs(dataCollectionRef);

          const dataArray: TempData[] = dataSnapshots.docs.map((doc) => {
            const data = doc.data();
            console.log(data);
            return {
              id: doc.id,
              ...data,
              date_time: (data.date_time as Timestamp).toDate(),
            } as TempData;
          });

          return { tempId, dataArray };
        });

        const results = await Promise.all(dataPromises);
        const dataMap: Record<string, TempData[]> = {};

        results.forEach(({ tempId, dataArray }) => {
          dataMap[tempId] = dataArray;
        });

        setTempDataMap(dataMap);
      } catch (error) {
        console.error('Error fetching temperature data:', error);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h1 className="text-2xl font-semibold mb-4">Please Sign In</h1>
        <button
          onClick={handleGoogleSignIn}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  if (Object.keys(tempDataMap).length === 0) {
    return <div>Loading temperature data...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">All Temperature Data</h1>
      {Object.entries(tempDataMap).map(([tempId, dataArray]) => (
        <div key={tempId} className="border border-gray-300 rounded-lg mb-6 p-4">
          <h2 className="text-2xl font-semibold mb-4">Temperature ID: {tempId}</h2>
          {dataArray.map((data) => (
            <div key={data.id} className="bg-gray-100 p-4 mb-4 rounded-lg">
              <h3 className="text-xl font-medium mb-2">Entry {data.id}</h3>
              <p className="text-gray-700">Date Time: {data.date_time.toLocaleString()}</p>
              <p className="text-gray-700">Humidity: {data.Humidity}%</p>
              <p className="text-gray-700">Temperature: {data.Temperature}°C</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Dht22Page;
