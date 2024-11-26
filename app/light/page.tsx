// app/light/page.tsx

'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
} from 'firebase/firestore';
import {
  auth,
  db,
} from '../../lib/firebase'; // Adjust the path if necessary
import { LightData } from '../../interfaces/lightData';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from 'firebase/auth';
import { formatTime } from '../../utils/formatTime'; // Import the helper function

const handleGoogleSignIn = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const userCredential = await signInWithPopup(auth, provider);
    console.log('Google Sign-In successful:', userCredential.user);
  } catch (error) {
    console.error('Error with Google Sign-In:', error);
  }
};

const LightPage: React.FC = () => {
  const [lightDataMap, setLightDataMap] = useState<Record<string, LightData[]>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Handle Authentication State
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

  // Fetch Light Data After User is Authenticated
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const lightCollectionRef = collection(db, 'Lighting');
        const lightSnapshots = await getDocs(lightCollectionRef);

        const dataPromises = lightSnapshots.docs.map(async (lightDoc) => {
          const lightId = lightDoc.id;
          const dataCollectionRef = collection(db, 'Lighting', lightId, 'Data');
          const dataSnapshots = await getDocs(dataCollectionRef);

          const dataArray: LightData[] = dataSnapshots.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
            } as LightData;
          });

          return { lightId, dataArray };
        });

        const results = await Promise.all(dataPromises);
        const dataMap: Record<string, LightData[]> = {};

        results.forEach(({ lightId, dataArray }) => {
          dataMap[lightId] = dataArray;
        });

        setLightDataMap(dataMap);
      } catch (error) {
        console.error('Error fetching light data:', error);
      }
    };

    fetchData();
  }, [user]);

  // Render Loading State
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Render Sign-In Prompt
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

  // Render Loading State for Data
  if (Object.keys(lightDataMap).length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading light data...</div>
      </div>
    );
  }

  // Render Light Data
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">All Light Data</h1>
      {Object.entries(lightDataMap).map(([lightId, dataArray]) => (
        <div key={lightId} className="border border-gray-300 rounded-lg mb-6 p-4">
          <h2 className="text-2xl font-semibold mb-4">Light ID: {lightId}</h2>
          {dataArray.map((data) => (
            <div key={data.id} className="bg-gray-100 p-4 mb-4 rounded-lg">
              <h3 className="text-xl font-medium mb-2">Entry {data.id}</h3>
              <p className="text-gray-700">
                Start Time: {formatTime(data.start_time)}
              </p>
              <p className="text-gray-700">
                End Time: {formatTime(data.end_time)}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default LightPage;
