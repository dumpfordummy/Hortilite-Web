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
  const [selectedImages, setSelectedImages] = useState<(string | null)[]>([null, null]);
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>([null, null]);
  const [labels, setLabels] = useState<string[]>([]);
  const [greenPixelData, setGreenPixelData] = useState<number[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

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

  const handleImageSelect = (index: number, imageName: string | null) => {
    const updatedSelectedImages = [...selectedImages];
    const updatedPreviewUrls = [...previewUrls];
    updatedSelectedImages[index] = imageName;

    if (imageName) {
      const selectedImage = images.find((img) => img.name === imageName);
      updatedPreviewUrls[index] = selectedImage ? selectedImage.url : null;
    } else {
      updatedPreviewUrls[index] = null;
    }

    setSelectedImages(updatedSelectedImages);
    setPreviewUrls(updatedPreviewUrls);
  };

  const addImageField = () => {
    setSelectedImages([...selectedImages, null]);
    setPreviewUrls([...previewUrls, null]);
  };

  const removeImageField = () => {
    if (selectedImages.length > 2) {
      setSelectedImages(selectedImages.slice(0, -1));
      setPreviewUrls(previewUrls.slice(0, -1));
    }
  };

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.setData('text/plain', index.toString());
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const draggedIndex = parseInt(event.dataTransfer.getData('text/plain'), 10);

    if (draggedIndex !== index) {
      const updatedSelectedImages = [...selectedImages];
      const updatedPreviewUrls = [...previewUrls];

      const [draggedImage] = updatedSelectedImages.splice(draggedIndex, 1);
      const [draggedPreview] = updatedPreviewUrls.splice(draggedIndex, 1);

      updatedSelectedImages.splice(index, 0, draggedImage);
      updatedPreviewUrls.splice(index, 0, draggedPreview);

      setSelectedImages(updatedSelectedImages);
      setPreviewUrls(updatedPreviewUrls);
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const analyzeImages = async () => {
    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      const formData = new FormData();

      for (const imageName of selectedImages) {
        if (imageName) {
          const image = images.find((img) => img.name === imageName);
          if (image) {
            const response = await fetch(image.url);
            const blob = await response.blob();
            formData.append('images', blob, image.name);
          }
        }
      }

      const response = await fetch('http://127.0.0.1:5000/process-and-analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze images: ${response.statusText}`);
      }

      const result = await response.json();
      setAnalysisResult(result);

      const newLabels = result.processed_images.map((img: any) => img.filename);
      const newData = result.processed_images.map((img: any) => img.green_percentage);

      setLabels(newLabels);
      setGreenPixelData(newData);
    } catch (error) {
      console.error('Error analyzing images:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <div>Loading...</div>;

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
    <div className="p-6">
      <h1 className="text-3xl font-bold text-center mb-4">Growth Rate Analysis</h1>
      <p>Select images to analyze:</p>

      {selectedImages.map((selectedImage, index) => (
        <div
          key={index}
          draggable
          onDragStart={(e) => onDragStart(e, index)}
          onDrop={(e) => onDrop(e, index)}
          onDragOver={onDragOver}
          className="flex items-center mb-4 border-dashed border-2 border-gray-300 p-2 rounded-md"
        >
          <select
            value={selectedImage || ''}
            onChange={(e) => handleImageSelect(index, e.target.value)}
            className="block border border-gray-300 rounded p-2 w-full"
          >
            <option value="" disabled>
              Select an image
            </option>
            {images.map((image) => (
              <option key={image.name} value={image.name}>
                {image.name}
              </option>
            ))}
          </select>
          {previewUrls[index] && (
            <img
              src={previewUrls[index] as string}
              alt={`Selected Image ${index + 1}`}
              style={{ maxWidth: '100px', maxHeight: '100px', marginLeft: '10px' }}
            />
          )}
        </div>
      ))}

      <div className="flex gap-4 mt-4">
        <button
          onClick={addImageField}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          +
        </button>
        <button
          onClick={removeImageField}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          disabled={selectedImages.length <= 2}
        >
          -
        </button>
      </div>

      <button
        onClick={analyzeImages}
        disabled={selectedImages.filter((img) => img).length < 2 || analyzing}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        {analyzing ? 'Analyzing...' : 'Analyze'}
      </button>

      {greenPixelData.length > 0 && labels.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-bold">Analysis Result</h2>
          <LineChart labels={labels} data={greenPixelData} label="Green Pixel Percentage" />
        </div>
      )}
    </div>
  );
};

export default AnalysisPage;
