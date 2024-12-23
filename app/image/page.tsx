"use client";

import React, { useState } from "react";

const ProcessImagePage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [responseMessage, setResponseMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select an image file before submitting.");
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const response = await fetch("http://localhost:5000/process-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const blob = await response.blob();
      const imageURL = URL.createObjectURL(blob);
      setResponseMessage(imageURL);
      setErrorMessage(null);
    } catch (error: any) {
      setErrorMessage(error.message || "An unexpected error occurred.");
      setResponseMessage(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">Process Image</h1>
      <div className="mb-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full border border-gray-300 rounded p-2"
        />
      </div>
      <button
        onClick={handleSubmit}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Submit
      </button>

      {responseMessage && (
        <div className="mt-6">
          <h2 className="text-lg font-medium">Processed Image:</h2>
          <img src={responseMessage} alt="Processed" className="mt-4 border border-gray-300" />
        </div>
      )}

      {errorMessage && (
        <div className="mt-6 text-red-500">
          <p>{errorMessage}</p>
        </div>
      )}
    </div>
  );
};

export default ProcessImagePage;
