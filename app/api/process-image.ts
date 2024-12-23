import { NextApiRequest, NextApiResponse } from 'next';
import { processImage } from '../../lib/imageProcessor';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { buffer } = req.file as Express.Multer.File;

  const clipLimit = 3; // Adjust this as needed
  const tileGridSize: [number, number] = [8, 8];
  const gammaValue = 0.6; // For overexposed images

  try {
    const processedBuffer = await processImage(buffer, gammaValue, clipLimit, tileGridSize);
    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(processedBuffer);
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ message: 'Error processing image' });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
