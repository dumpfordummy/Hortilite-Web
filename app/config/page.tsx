'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

const handleGoogleSignIn = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error signing in:', error);
  }
};

export default function UpdateGlobalPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [newValue, setNewValue] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Check user authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch the current value of the field
  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          const docRef = doc(db, 'Global', 'YhqJZ0hzHPOSubq49rCZ'); // Replace with your document ID
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setCurrentValue(docSnap.data().collectionIntervalHour);
          } else {
            console.error('No such document!');
          }
        } catch (error) {
          console.error('Error fetching document:', error);
        }
      };
      fetchData();
    }
  }, [user]);

  // Handle the update of the field
  const handleUpdate = async () => {
    if (newValue < 1 || newValue > 24) {
      setErrorMessage('Value must be between 1 and 24.');
      return;
    }

    try {
      const docRef = doc(db, 'Global', 'YhqJZ0hzHPOSubq49rCZ'); // Replace with your document ID
      await updateDoc(docRef, { collectionIntervalHour: newValue });
      setCurrentValue(newValue);
      setErrorMessage('');
      alert('Field updated successfully!');
    } catch (error) {
      console.error('Error updating document:', error);
      setErrorMessage('Failed to update the field.');
    }
  };

  if (loading) return <div>Loading...</div>;

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
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Data Retrieval Interval</h1>
      {errorMessage && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{errorMessage}</div>
      )}
      <div className="mb-6">
        <p className="text-lg font-medium">Current Value: {currentValue ?? 'Loading...'} hours</p>
      </div>
      <div className="mb-4">
        <label htmlFor="newValue" className="block text-lg font-medium mb-2">
          New Value (1-24):
        </label>
        <input
          type="number"
          id="newValue"
          value={newValue}
          onChange={(e) => setNewValue(Number(e.target.value))}
          min={1}
          max={24}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        onClick={handleUpdate}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        Update Value
      </button>
    </div>
  );
}
