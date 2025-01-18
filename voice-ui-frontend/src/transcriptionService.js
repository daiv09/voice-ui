// // transcriptionService.js
// export async function transcribeAudio(file) {
//     try {
//       // Placeholder transcription logic
//       const transcription = await new Promise((resolve) =>
//         setTimeout(() => resolve(`Transcribed text for ${file.name}`), 2000)
//       );
//       return transcription;
//     } catch (error) {
//       throw new Error("Failed to transcribe the audio file.");
//     }
//   }
  
// transcriptionService.js
import axios from 'axios';

// Define the AssemblyAI API endpoint
const BASE_URL = 'https://api.assemblyai.com/v2';
const API_KEY = 'c0c0934e394d4a6f87fd3e72b4784b34'; // Use your actual API key

// Function to upload audio to AssemblyAI
const uploadAudio = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${BASE_URL}/upload`, formData, {
      headers: {
        'authorization': API_KEY,
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.upload_url; // This is the URL for transcription
  } catch (error) {
    console.error('Error uploading file:', error.message);
    throw error;
  }
};

// Function to transcribe audio
export async function transcribeAudio(file) {
  try {
    // Step 1: Upload audio to AssemblyAI
    const audioUrl = await uploadAudio(file);

    // Step 2: Request transcription using the uploaded file URL
    const response = await axios.post(`${BASE_URL}/transcript`, {
      audio_url: audioUrl,
      speaker_labels: true,
    }, {
      headers: { 'authorization': API_KEY },
    });

    const transcriptId = response.data.id;

    // Step 3: Poll the transcription status
    let transcriptStatus = 'processing';
    let transcriptText = '';
    
    while (transcriptStatus === 'processing' || transcriptStatus === 'queued') {
      const statusResponse = await axios.get(`${BASE_URL}/transcript/${transcriptId}`, {
        headers: { 'authorization': API_KEY },
      });

      transcriptStatus = statusResponse.data.status;
      if (transcriptStatus === 'completed') {
        transcriptText = statusResponse.data.text;
      } else {
        console.log(`Transcription status: ${transcriptStatus}`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait before polling again
      }
    }

    return transcriptText;
  } catch (error) {
    console.error('Error during transcription:', error.message);
    throw error;
  }
}
