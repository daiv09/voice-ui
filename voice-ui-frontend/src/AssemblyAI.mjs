import { AssemblyAI } from "assemblyai";
import axios from 'axios'
// import fs from 'fs-extra'

const baseUrl = 'https://api.assemblyai.com/v2'

const client = new AssemblyAI({
  apiKey: "c0c0934e394d4a6f87fd3e72b4784b34", //YOUR_API_KEY
});

// const audioUrl = "https://drive.google.com/drive/  folders/1NxUBvZ0NKtrQEjUS5cjktN_tifutvvPT";

// // Function to upload audio file
// const uploadAudio = async (filePath) => {
//   try {
//     const file = fs.createReadStream(filePath);

//     const response = await axios.post("https://api.assemblyai.com/v2/upload", file, {
//       headers: {
//         authorization: "c0c0934e394d4a6f87fd3e72b4784b34", // YOUR_API_KEY
//         "Transfer-Encoding": "chunked",
//       },
//     });

//     return response.data.upload_url;
//   } catch (error) {
//     console.error("Error uploading audio file:", error.message);
//     throw error;
//   }
// };

const audioUrl = "https://assembly.ai/sports_injuries.mp3";
// Request parameters
const config = {
  audio_url: audioUrl,
  speaker_labels: true,
  // speakers_expected: 3,
  // summarization: true,
  // summary_model: 'conversational',
  // summary_type: 'bullets'
};

export const run = async () => {
  let transcript = await client.transcripts.transcribe(config, {
    poll: false,
  });
  if (transcript.status === 'error') {
    console.error(`Transcription failed: ${transcript.error}`)
    process.exit(1)
  }
  while (transcript.status !== "completed") {
    transcript = await client.transcripts.get(transcript.id);
    console.log(transcript.status);
    await sleep(3000);
  }

  console.log(transcript.text);
  // for (const utterance of transcript.utterances) {
  //   console.log(`Speaker ${utterance.speaker}: ${utterance.text}`);
  // }

  return transcript.text;


  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};