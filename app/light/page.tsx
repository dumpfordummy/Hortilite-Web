// app/light/page.tsx

'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase'; // Ensure the path is correct
import { LightData } from '../../interfaces/lightData';
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User, // Import the User type directly
} from 'firebase/auth';
import { formatTime } from '../../utils/formatTime'; // Ensure this utility exists
import { isOverlapping, hasConflict, TimeInterval } from '../../utils/timeUtils'; // Import utility functions

// Interface for processed light data
interface ProcessedLightData {
  id: string;
  startTime: string;
  endTime: string;
  duration: number; // Duration in minutes
  start_time: number; // Original start_time in HHMM
  end_time: number;   // Original end_time in HHMM
}

// Interface for editing light data
interface EditLightData {
  id: string;
  start_time: number;
  end_time: number;
}

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
  const [lightDataMap, setLightDataMap] = useState<Record<string, ProcessedLightData[]>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // States for editing
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditLightData>({
    id: '',
    start_time: 0,
    end_time: 0,
  });

  // States for adding
  const [addFormData, setAddFormData] = useState<{
    lightId: string;
    start_time: number;
    end_time: number;
  }>({
    lightId: '',
    start_time: 0,
    end_time: 0,
  });

  // State for error messages
  const [errorMessage, setErrorMessage] = useState<string>('');

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

  // Helper function to calculate duration in minutes
  const calculateDuration = (start: number, end: number): number => {
    const startHours = Math.floor(start / 100);
    const startMinutes = start % 100;
    const endHours = Math.floor(end / 100);
    const endMinutes = end % 100;

    const startTotal = startHours * 60 + startMinutes;
    const endTotal = endHours * 60 + endMinutes;

    return endTotal - startTotal;
  };

  // Fetch Light Data After User is Authenticated
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const lightCollectionRef = collection(db, 'Lighting'); // Ensure 'Lighting' is correct
        const lightSnapshots = await getDocs(lightCollectionRef);

        const dataPromises = lightSnapshots.docs.map(async (lightDoc) => {
          const lightId = lightDoc.id;
          const dataCollectionRef = collection(db, 'Lighting', lightId, 'Data');
          const dataSnapshots = await getDocs(dataCollectionRef);

          const dataArray: ProcessedLightData[] = dataSnapshots.docs.map((doc) => {
            const data = doc.data();
            // Assuming LightData interface has start_time and end_time as numbers
            const start_time: number = data.start_time;
            const end_time: number = data.end_time;

            const duration = calculateDuration(start_time, end_time);

            return {
              id: doc.id,
              startTime: formatTime(start_time),
              endTime: formatTime(end_time),
              duration,
              start_time,
              end_time,
            };
          });

          return { lightId, dataArray };
        });

        const results = await Promise.all(dataPromises);
        const dataMap: Record<string, ProcessedLightData[]> = {};

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

  // Handle Edit Button Click
  const handleEditClick = (recordId: string, data: ProcessedLightData) => {
    setEditingRecordId(recordId);
    // Set form data with original values
    setEditFormData({
      id: data.id,
      start_time: data.start_time,
      end_time: data.end_time,
    });
    setErrorMessage(''); // Reset any previous error messages
  };

  // Handle Edit Form Change
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: parseInt(value) || 0,
    }));
  };

  // Handle Edit Form Submit
  const handleEditFormSubmit = async (lightId: string) => {
    // Validate that start_time is less than end_time
    if (editFormData.start_time >= editFormData.end_time) {
      setErrorMessage('Start Time must be less than End Time.');
      return;
    }

    // Validate HHMM format
    if (!isValidHHMM(editFormData.start_time) || !isValidHHMM(editFormData.end_time)) {
      setErrorMessage('Please enter valid start and end times in HHMM format.');
      return;
    }

    // Prepare updated interval
    const updatedInterval: TimeInterval = {
      start: editFormData.start_time,
      end: editFormData.end_time,
    };

    // Get existing intervals excluding the record being edited
    const existingRecords = lightDataMap[lightId];
    const existingIntervals: TimeInterval[] = existingRecords
      .filter((record) => record.id !== editFormData.id)
      .map((record) => ({
        start: record.start_time,
        end: record.end_time,
      }));

    // Get records excluding the one being edited
    const filteredRecords = existingRecords.filter((record) => record.id !== editFormData.id);

    // Check for conflicts
    if (hasConflict(existingIntervals, updatedInterval, null, filteredRecords)) {
      setErrorMessage('The specified time range conflicts with an existing record.');
      return;
    }

    try {
      const dataDocRef = doc(db, 'Lighting', lightId, 'Data', editFormData.id);
      await updateDoc(dataDocRef, {
        start_time: editFormData.start_time,
        end_time: editFormData.end_time,
      });
      console.log('Light data updated successfully');

      // Refresh data
      const updatedDoc = await getDocs(collection(db, 'Lighting', lightId, 'Data'));
      const updatedDataArray: ProcessedLightData[] = updatedDoc.docs.map((doc) => {
        const data = doc.data();
        const start_time: number = data.start_time;
        const end_time: number = data.end_time;

        const duration = calculateDuration(start_time, end_time);

        return {
          id: doc.id,
          startTime: formatTime(start_time),
          endTime: formatTime(end_time),
          duration,
          start_time,
          end_time,
        };
      });

      setLightDataMap((prevMap) => ({
        ...prevMap,
        [lightId]: updatedDataArray,
      }));

      setEditingRecordId(null);
      setErrorMessage(''); // Reset error message on success
    } catch (error) {
      console.error('Error updating light data:', error);
      setErrorMessage('Failed to update the record. Please try again.');
    }
  };

  // Handle Cancel Edit
  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setErrorMessage(''); // Reset any error messages
  };

  // Handle Add Form Change
  const handleAddFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAddFormData((prev) => ({
      ...prev,
      [name]: name === 'lightId' ? value : parseInt(value) || 0,
    }));
  };

  // Handle Add Form Submit
  const handleAddFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { lightId, start_time, end_time } = addFormData;

    // Validate inputs
    if (!lightId) {
      setErrorMessage('Please select a Light Device to add a record.');
      return;
    }

    if (start_time >= end_time) {
      setErrorMessage('Start Time must be less than End Time.');
      return;
    }

    // Validate HHMM format
    if (!isValidHHMM(start_time) || !isValidHHMM(end_time)) {
      setErrorMessage('Please enter valid start and end times in HHMM format.');
      return;
    }

    // Prepare new interval
    const newInterval: TimeInterval = { start: start_time, end: end_time };

    // Get existing intervals for the selected light device
    const existingRecords = lightDataMap[lightId];
    const existingIntervals: TimeInterval[] = existingRecords.map((record) => ({
      start: record.start_time,
      end: record.end_time,
    }));

    // Check for conflicts
    if (hasConflict(existingIntervals, newInterval, null, existingRecords)) {
      setErrorMessage('The specified time range conflicts with an existing record.');
      return;
    }

    try {
      // Determine next incremental ID
      let nextId = 1;
      if (existingRecords.length > 0) {
        const existingIds = existingRecords.map((record) => parseInt(record.id)).filter(id => !isNaN(id));
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        nextId = maxId + 1;
      }

      const newId = nextId.toString();

      const dataDocRef = doc(db, 'Lighting', lightId, 'Data', newId);
      await setDoc(dataDocRef, {
        start_time,
        end_time,
      });
      console.log('New light data added successfully');

      // Refresh data
      const updatedDataSnapshots = await getDocs(collection(db, 'Lighting', lightId, 'Data'));
      const updatedDataArray: ProcessedLightData[] = updatedDataSnapshots.docs.map((doc) => {
        const data = doc.data();
        const start_time: number = data.start_time;
        const end_time: number = data.end_time;

        const duration = calculateDuration(start_time, end_time);

        return {
          id: doc.id,
          startTime: formatTime(start_time),
          endTime: formatTime(end_time),
          duration,
          start_time,
          end_time,
        };
      });

      setLightDataMap((prevMap) => ({
        ...prevMap,
        [lightId]: updatedDataArray,
      }));

      // Reset add form
      setAddFormData({
        lightId: '',
        start_time: 0,
        end_time: 0,
      });

      setErrorMessage(''); // Reset error message on success
    } catch (error) {
      console.error('Error adding new light data:', error);
      setErrorMessage('Failed to add the record. Please try again.');
    }
  };

  // Handle Delete Record
  const handleDeleteRecord = async (lightId: string, recordId: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      const dataDocRef = doc(db, 'Lighting', lightId, 'Data', recordId);
      await deleteDoc(dataDocRef);
      console.log('Light data deleted successfully');

      // Refresh data
      const updatedDoc = await getDocs(collection(db, 'Lighting', lightId, 'Data'));
      const updatedDataArray: ProcessedLightData[] = updatedDoc.docs.map((doc) => {
        const data = doc.data();
        const start_time: number = data.start_time;
        const end_time: number = data.end_time;

        const duration = calculateDuration(start_time, end_time);

        return {
          id: doc.id,
          startTime: formatTime(start_time),
          endTime: formatTime(end_time),
          duration,
          start_time,
          end_time,
        };
      });

      setLightDataMap((prevMap) => ({
        ...prevMap,
        [lightId]: updatedDataArray,
      }));
    } catch (error) {
      console.error('Error deleting light data:', error);
      setErrorMessage('Failed to delete the record. Please try again.');
    }
  };

  // Validate HHMM format
  const isValidHHMM = (time: number): boolean => {
    if (time < 0 || time > 2359) return false;
    const minutes = time % 100;
    return minutes >= 0 && minutes < 60;
  };

  // Extract all light device IDs for the add form
  const allLightIds = Object.keys(lightDataMap);

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

  // Render Light Data with Tables and Forms
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">All Light Data</h1>

      {/* Display Error Message */}
      {errorMessage && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {errorMessage}
        </div>
      )}

      {/* Add New Record Form */}
      <div className="mb-8 p-4 border border-gray-300 rounded-lg bg-white shadow">
        <h2 className="text-2xl font-semibold mb-4">Add New Light Record</h2>
        <form onSubmit={handleAddFormSubmit} className="flex flex-col space-y-4">
          {/* Select Light Device */}
          <div>
            <label htmlFor="lightId" className="block text-gray-700 font-medium mb-2">
              Light Device
            </label>
            <select
              id="lightId"
              name="lightId"
              value={addFormData.lightId}
              onChange={handleAddFormChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300"
              required
            >
              <option value="">-- Select Light Device --</option>
              {allLightIds.map((lightId) => (
                <option key={lightId} value={lightId}>
                  {lightId}
                </option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div>
            <label htmlFor="start_time" className="block text-gray-700 font-medium mb-2">
              Start Time (HHMM)
            </label>
            <input
              type="number"
              id="start_time"
              name="start_time"
              value={addFormData.start_time}
              onChange={handleAddFormChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300"
              placeholder="e.g., 800 for 8:00 AM"
              required
              min={0}
              max={2359}
            />
          </div>

          {/* End Time */}
          <div>
            <label htmlFor="end_time" className="block text-gray-700 font-medium mb-2">
              End Time (HHMM)
            </label>
            <input
              type="number"
              id="end_time"
              name="end_time"
              value={addFormData.end_time}
              onChange={handleAddFormChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300"
              placeholder="e.g., 1400 for 2:00 PM"
              required
              min={0}
              max={2359}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="self-start px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Add Record
          </button>
        </form>
      </div>

      {/* Light Data Tables and Edit Forms */}
      {Object.entries(lightDataMap).map(([lightId, dataArray]) => (
        <div key={lightId} className="border border-gray-300 rounded-lg mb-8 p-4">
          <h2 className="text-2xl font-semibold mb-4">Light ID: {lightId}</h2>

          {/* Display Records in a Table */}
          <table className="min-w-full bg-white border">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">Entry ID</th>
                <th className="py-2 px-4 border-b">Start Time</th>
                <th className="py-2 px-4 border-b">End Time</th>
                <th className="py-2 px-4 border-b">Duration</th>
                <th className="py-2 px-4 border-b">Actions</th>
                <th className="py-2 px-4 border-b">Delete</th> {/* New Column */}
              </tr>
            </thead>
            <tbody>
              {dataArray.map((data) => (
                <tr key={data.id} className="text-center">
                  <td className="py-2 px-4 border-b">{data.id}</td>
                  {/* If this record is being edited */}
                  {editingRecordId === data.id ? (
                    <>
                      <td className="py-2 px-4 border-b">
                        <input
                          type="number"
                          name="start_time"
                          value={editFormData.start_time}
                          onChange={handleEditFormChange}
                          className="w-24 px-2 py-1 border rounded-md focus:outline-none focus:ring focus:border-blue-300"
                          min={0}
                          max={2359}
                        />
                      </td>
                      <td className="py-2 px-4 border-b">
                        <input
                          type="number"
                          name="end_time"
                          value={editFormData.end_time}
                          onChange={handleEditFormChange}
                          className="w-24 px-2 py-1 border rounded-md focus:outline-none focus:ring focus:border-blue-300"
                          min={0}
                          max={2359}
                        />
                      </td>
                      <td className="py-2 px-4 border-b">
                        {calculateDuration(editFormData.start_time, editFormData.end_time)} mins
                      </td>
                      <td className="py-2 px-4 border-b">
                        <button
                          onClick={() => handleEditFormSubmit(lightId)}
                          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </td>
                      <td className="py-2 px-4 border-b"></td> {/* Empty cell for Delete button when editing */}
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-4 border-b">{data.startTime}</td>
                      <td className="py-2 px-4 border-b">{data.endTime}</td>
                      <td className="py-2 px-4 border-b">{data.duration} mins</td>
                      <td className="py-2 px-4 border-b">
                        <button
                          onClick={() => handleEditClick(data.id, data)}
                          className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          Edit
                        </button>
                      </td>
                      <td className="py-2 px-4 border-b">
                        <button
                          onClick={() => handleDeleteRecord(lightId, data.id)}
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 ml-2"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default LightPage;
