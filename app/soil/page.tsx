// app/soil.tsx

"use client"
import { useEffect, useState } from 'react';
import { collection, getDocs, Timestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { SoilData } from '../../interfaces/soilData';
import { User, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';


const handleGoogleSignIn = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const userCredential = await signInWithPopup(auth, provider);
    console.log('Google Sign-In successful:', userCredential.user);
  } catch (error) {
    console.error('Error with Google Sign-In:', error);
  }
};

const SoilPage: React.FC = () => {
  const [soilDataMap, setSoilDataMap] = useState<Record<string, SoilData[]>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  

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

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const soilCollectionRef = collection(db, 'Soil');
        const soilSnapshots = await getDocs(soilCollectionRef);

        const dataPromises = soilSnapshots.docs.map(async (soilDoc) => {
          const soilId = soilDoc.id;
          const dataCollectionRef = collection(db, 'Soil', soilId, 'Data');
          const dataSnapshots = await getDocs(dataCollectionRef);

          const dataArray: SoilData[] = dataSnapshots.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              date_time: (data.date_time as Timestamp).toDate(),
            } as SoilData;
          });

          return { soilId, dataArray };
        });

        const results = await Promise.all(dataPromises);
        const dataMap: Record<string, SoilData[]> = {};

        results.forEach(({ soilId, dataArray }) => {
          dataMap[soilId] = dataArray;
        });

        setSoilDataMap(dataMap);
      } catch (error) {
        console.error('Error fetching soil data:', error);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div>
        <h1>Please Sign In</h1>
        <button onClick={handleGoogleSignIn}>Sign In with Google</button>
      </div>
    );
  }

  if (Object.keys(soilDataMap).length === 0) {
    return <div>Loading soil data...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">All Soil Data</h1>
      {Object.entries(soilDataMap).map(([soilId, dataArray]) => (
        <div key={soilId} className="border border-gray-300 rounded-lg mb-6 p-4">
          <h2 className="text-2xl font-semibold mb-4">Soil ID: {soilId}</h2>
          {dataArray.map((data) => (
            <div key={data.id} className="bg-gray-100 p-4 mb-4 rounded-lg">
              <h3 className="text-xl font-medium mb-2">Entry {data.id}</h3>
              <p className="text-gray-700">Date Time: {data.date_time.toString()}</p>
              <p className="text-gray-700">EC: {data.EC} us/cm</p>
              <p className="text-gray-700">Humidity: {data.Humidity}%</p>
              <p className="text-gray-700">Moisture: {data.Moisture}%</p>
              <p className="text-gray-700">Nitrogen: {data.Nitrogen} mg/kg</p>
              <p className="text-gray-700">pH: {data.pH}</p>
              <p className="text-gray-700">Phosphorus: {data.Phosphorus} mg/kg</p>
              <p className="text-gray-700">Potassium: {data.Potassium} mg/kg</p>
              <p className="text-gray-700">Temperature: {data.Temperature} °C</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default SoilPage;
