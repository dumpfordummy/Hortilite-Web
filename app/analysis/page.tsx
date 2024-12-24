'use client';

import React, { useState, useEffect } from 'react';
import LineChart from './LineChart'; 
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../../lib/firebase';
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

const AnalysisPage: React.FC = () => {
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [selectedImage1, setSelectedImage1] = useState<string | null>(null);
  const [selectedImage2, setSelectedImage2] = useState<string | null>(null);
  const [previewUrl1, setPreviewUrl1] = useState<string | null>(null);
  const [previewUrl2, setPreviewUrl2] = useState<string | null>(null);
  const [greenPixelData, setGreenPixelData] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
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

  // Fetch images from Firebase Storage
  useEffect(() => {
    const fetchImages = async () => {
      const listRef = ref(storage);
      const res = await listAll(listRef);

      const imageList = await Promise.all(
        res.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          return { name: itemRef.name, url };
        })
      );

      setImages(imageList);
    };

    fetchImages();
  }, []);

  // Image selection and fetch image download URL
  const handleImageSelect = async (
    imageName: string | null,
    setSelectedImage: React.Dispatch<React.SetStateAction<string | null>>,
    setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    setSelectedImage(imageName);

    if (imageName) {
      const selectedImage = images.find((img) => img.name === imageName);
      if (selectedImage) {
        setPreviewUrl(selectedImage.url);
      }
    } else {
      setPreviewUrl(null);
    }
  };

  // Image analysis
  const analyzeImages = () => {
    if (selectedImage1 && selectedImage2) {

    }
  };

  if (loading) return <div>Loading...</div>; // loading

  // If user is not signed in, display sign-in prompt
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

  return (
    <div className='p-6'>
      <h1 className="text-3xl font-bold text-center mb-4">Growth Rate Analysis</h1>
      <p>Select two images to analyze:</p>
      <div>
        <div className="min-h-screen flex flex-row items-center justify-center p-6 bg-gray-50">
          <div style={{ flex: 1, marginRight: '10px' }} className='flex flex-col items-center justify-center min-h-screen rounded-md border-dashed border-2 border-green-600'>
            <label className='text-lg'>Image 1: </label>
            <select value={selectedImage1 || ''} onChange={(e) => handleImageSelect(e.target.value, setSelectedImage1, setPreviewUrl1)}
              className="block border border-gray-300 rounded p-2">
              <option value="" disabled>Select an image</option>
              {images.map((image) => (
                <option key={image.name} value={image.name}>
                  {image.name}
                </option>
              ))}
            </select>
            {previewUrl1 && (
              <div>
                <h4>Currently Selected Image 1:</h4>
                <img
                  src={previewUrl1}
                  alt="Selected Image 1"
                  style={{ maxWidth: '300px', maxHeight: '300px', marginTop: '10px' }}
                />
              </div>
            )}
          </div>
          <div style={{ flex: 1, marginLeft: '10px' }} className='flex flex-col items-center justify-center min-h-screen rounded-md border-dashed border-2 border-green-600'>
            <label className='text-lg'>Image 2: </label>
            <select value={selectedImage2 || ''} onChange={(e) => handleImageSelect(e.target.value, setSelectedImage2, setPreviewUrl2)} 
            className="block border border-gray-300 rounded p-2">
              <option value="" disabled>Select an image</option>
              {images.map((image) => (
                <option key={image.name} value={image.name}>
                  {image.name}
                </option>
              ))}
            </select>
            {previewUrl2 && (
              <div>
                <h4>Currently Selected Image 2:</h4>
                <img
                  src={previewUrl2}
                  alt="Selected Image 2"
                  style={{ maxWidth: '300px', maxHeight: '300px', marginTop: '10px' }}
                />
              </div>
            )}
          </div>
        </div>

        <br />
        <button onClick={analyzeImages} disabled={!selectedImage1 || !selectedImage2} 
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Analyze
        </button>
      </div>

      {greenPixelData.length > 0 && labels.length > 0 && (
        <div>
          <h2>Analysis Result</h2>
          <LineChart
            labels={labels}
            data={greenPixelData}
            label={`Growth Rate Analysis: ${selectedImage1} vs ${selectedImage2}`}
          />
        </div>
      )}
    </div>
  );
};

export default AnalysisPage;