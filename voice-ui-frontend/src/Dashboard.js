import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Quill from "quill";
import html2pdf from "html2pdf.js";
import { AuthProvider } from "./AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "quill/dist/quill.snow.css";
import "react-toastify/dist/ReactToastify.css";
import { run } from './AssemblyAI.mjs'; // Import the transcription logic
import { transcribeAudio } from "./transcriptionService";

const Dashboard = () => {
  const [newText, setNewText] = useState(""); // For adding new data
  const [savedData, setSavedData] = useState([]);
  const [recognitionInstance, setRecognitionInstance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [audioFile, setAudioFile] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState('');

  // Handle file input change
  // Example usage
  const handleTranscription = async (file) => {
    try {
      const transcription = await transcribeAudio(file);
      console.log(transcription);
    } catch (error) {
      console.error(error.message);
    }
  };

  // Function to handle file input change
  const handleFileChange = async (event) => {
    const file = event.target.files[0]; // Get the first selected file

    if (file) {
      try {
        // Handle file (e.g., transcribe audio file, upload, etc.)
        const transcription = await transcribeAudio(file);
        console.log("Transcription:", transcription);
      } catch (error) {
        console.error("Error during transcription:", error.message);
      }
    } else {
      console.log("No file selected.");
    }
  };
  // // Handle transcription
  // const handleTranscription = async () => {
  //   if (!audioFile) {
  //     setError('Please upload an audio file first.');
  //     return;
  //   }
  //   try {
  //     setError('');
  //     const transcript = await run(audioFile);
  //     setTranscript(transcript);
  //   } catch (err) {
  //     setError('Error processing transcription: ' + err.message);
  //   }
  // };


  const currentTasks = savedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Define a function to handle the pagination logic
  const goToPage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Logic for disabling the Previous/Next buttons based on the current page
  const isPreviousDisabled = currentPage === 1;
  const isNextDisabled = currentTasks.length < itemsPerPage;

  const token = localStorage.getItem("token");
  const accumulatedTranscript = useRef(""); // To store the entire transcript for the session

  useEffect(() => {
    setLoading(true);
    axios
      .get("http://localhost:4000/data", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        setSavedData(response.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toast.error("Failed to fetch data");
      });
  }, [token]);

  const startListening = () => {
    const recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();

    const availableLanguages = ["en-US", "fr-FR", "es-ES", "hi-IN"]; // Example language options
    const userSelectedLanguage = "en-US"; // Could come from a user input or settings

    const language = availableLanguages.includes(userSelectedLanguage)
      ? userSelectedLanguage
      : navigator.language;

    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        toast.error("No speech detected for 10 seconds, stopping recognition.");
        recognition.stop();
        clearTimeout(inactivityTimeout);
      } else {
        toast.error(`Speech recognition error: ${event.error}`);
      }
    };

    accumulatedTranscript.current = ""; // Reset the accumulated transcript
    let inactivityTimeout = null;

    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const finalText = result[0].transcript.trim(); // Trim the final text
          if (finalText) {
            accumulatedTranscript.current += finalText + " "; // Append only non-empty final text
          }
        } else {
          interimTranscript += result[0].transcript; // Collect interim results
        }
      }

      // Update the transcript displayed in the UI
      setTranscript(
        accumulatedTranscript.current.trim() + " " + interimTranscript.trim()
      );

      // Reset inactivity timeout whenever new text is generated
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        console.log("No speech detected for 10 seconds, stopping recognition.");
        recognition.stop();
      }, 10000); // 10 seconds timeout
    };
    recognition.onspeechend = () => {
      console.log("Speech has ended.");
      recognition.stop();
    };

    recognition.start();
    setRecognitionInstance(recognition);
    toast.info("Speech recognition started", {
      autoClose: 2000, // Duration in milliseconds (2000ms = 2 seconds)
    });
  };

  const stopListening = () => {
    if (recognitionInstance) {
      recognitionInstance.stop();
      setRecognitionInstance(null);

      const finalTranscript = accumulatedTranscript.current.trim();
      if (finalTranscript) {
        const currentTime = new Date();
        const timestamp = currentTime.toLocaleString(); // "12/21/2024, 14:30:45"

        axios
          .post(
            "http://localhost:4000/save",
            { text: finalTranscript },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .then((response) => {
            setSavedData((prev) => [
              ...prev,
              {
                text: finalTranscript,
                timestamp: response.data.timestamp || timestamp,
                noteId: Date.now(),
              },
            ]);
            toast.success("Data saved successfully");
          })
          .catch(() => toast.error("Failed to save data"));
      }

      setTranscript("");
      toast.info("Speech recognition stopped");
    }
  };

  const exportToPDF = (text, taskId, timestamp) => {
    if (!text) {
      toast.error("No transcript available to export");
      return;
    }

    const displayTimestamp = timestamp || new Date().toLocaleString();
    const element = document.createElement("div");
    element.innerHTML = `
        <h3>Task ID: ${taskId}</h3>
        <p>${text}</p>
        <p><small>Saved on: ${displayTimestamp}</small></p>
    `;
    document.body.appendChild(element);

    const opt = {
      margin: 10,
      filename: `task_${taskId}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf()
      .from(element)
      .set(opt)
      .save()
      .then(() => document.body.removeChild(element))
      .catch(() => {
        document.body.removeChild(element);
        toast.error("Failed to export PDF");
      });
  };

  const exportToCSV = (text, taskId, timestamp) => {
    if (!text) {
      toast.error("No transcript available to export");
      return;
    }
    const displayTimestamp = timestamp || new Date().toLocaleString();
    const csvContent = `data:text/csv;charset=utf-8,Task ID,Transcript,Timestamp\n"${taskId}","${text.replace(
      /"/g,
      '""'
    )}","${displayTimestamp}"`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `task_${taskId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Task exported to CSV");
  };

  const copyToClipboard = (text, timestamp) => {
    if (!text) {
      toast.error("No transcript available to copy");
      return;
    }
    const displayTimestamp = timestamp || new Date().toLocaleString();
    const contentToCopy = `${text}\nSaved on: ${displayTimestamp}`;
    navigator.clipboard
      .writeText(contentToCopy)
      .then(() => toast.success("Task copied to clipboard"))
      .catch(() => toast.error("Failed to copy task"));
  };

  const addData = async () => {
    if (!newText.trim()) {
      toast.error("Text cannot be empty");
      return;
    }
    const currentTime = new Date();
    const timestamp = currentTime.toLocaleString();

    try {
      const response = await axios.post(
        "http://localhost:4000/save",
        { text: newText, timestamp: timestamp },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedData((prev) => [
        ...prev,
        { text: newText, timestamp: timestamp, noteId: response.data.noteId },
      ]);
      setNewText(""); // Clear input
      toast.success("Data added successfully");
    } catch (error) {
      toast.error("Failed to add data");
    }
  };

  useEffect(() => {
    axios
      .get("http://localhost:4000/data", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        setSavedData(response.data);
      })
      .catch((error) => toast.error("Failed to fetch data"));
  }, [savedData]);

  const updateData = async (id, updatedText) => {
    if (!updatedText.trim()) {
      alert("Text cannot be empty");
      return;
    }
    try {
      const response = await axios.put(
        `http://localhost:4000/data/${id}`,
        { text: updatedText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedData((prev) =>
        prev.map((data) =>
          data.noteId === id ? { ...data, text: response.data.text } : data
        )
      );
      toast.success("Data updated successfully");
    } catch (error) {
      toast.error("Failed to update data");
    }
  };

  const deleteData = async (id) => {
    if (deleteConfirmation === id) {
      try {
        await axios.delete(`http://localhost:4000/data/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const response = await axios.get("http://localhost:4000/data", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSavedData(response.data);
        setDeleteConfirmation(null);
        toast.success("Data deleted successfully");
      } catch (error) {
        toast.error("Failed to delete data");
      }
    } else {
      setDeleteConfirmation(id);
      toast.info("Click Again! To Confirm Delete");
    }
  };

  // const transcribeAudioWithWhisper = async (file) => {
  //   const apiKey = "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";
  //   const formData = new FormData();
  //   formData.append("file", file);
  //   formData.append("model", "whisper-1"); // Specify the Whisper model
    
  //   try {
  //     const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData, {
  //       headers: {
  //         Authorization: `Bearer ${apiKey}`,
  //         "Content-Type": "multipart/form-data",
  //       },
  //     });
  //     return response.data.text; // Transcription result
  //   } catch (error) {
  //     console.error("Error during transcription:", error);
  //     throw new Error("Failed to transcribe audio");
  //   }
  // };

  // const handleAudioFileChange = async (event) => {
  //   const file = event.target.files[0];
  //   if (!file) {
  //     toast.error("Please upload an audio file");
  //     return;
  //   } 
  //   setAudioFile(file);
    
  //   try {
  //     const transcript = await transcribeAudioWithWhisper(file);
  //     console.log("Transcript:", transcript);
  //     toast.success("Audio transcribed successfully");
  //     setTranscript(transcript); // Update UI with the transcript
  //   } catch (error) {
  //     toast.error("Failed to transcribe audio");
  //   }
  // };

  // const handleTranscription = async () => {
  //   if (!audioFile) return;

  //   // Assuming you have a function to handle transcription
  //   const formData = new FormData();
  //   formData.append("audio", audioFile);

  //   try {
  //     const response = await fetch('/your-transcription-endpoint', { // Replace with actual endpoint
  //       method: 'POST',
  //       body: formData,
  //     });

  //     const result = await response.json();
  //     setTranscript(result.transcription); // Assuming the API returns the transcription
  //   } catch (error) {
  //     console.error('Error transcribing audio:', error);
  //     toast.error('Failed to transcribe audio');
  //   }
  // };

  //   useEffect(() => {
  //     const handleKeyDown = (event) => {
  //       // Check if the spacebar is pressed to start listening
  //       if (event.key === " " || event.keyCode === 32) {
  //         startListening();
  //       }

  //       // Check if the Escape key is pressed to stop listening
  //       if (event.key === "Escape") {
  //         stopListening();
  //       }
  //     };

  //     window.addEventListener("keydown", handleKeyDown);

  //     // Cleanup the event listener on component unmount
  //     return () => {
  //       window.removeEventListener("keydown", handleKeyDown);
  //     };
  //   }, [startListening, stopListening]); // Add both functions to the dependency array

  return (
    <div className="container mt-5">
      <ToastContainer />
      <h1 className="animate__animated animate__fadeIn">Dashboard</h1>
      <p className="text-muted text-center animate__animated animate__fadeInUp">
        Welcome to your dashboard! Here you can transcribe audio, manage tasks,
        and save your data effortlessly.
      </p>
      <div className="mb-4">
        <h2>Speech-to-Text</h2>
        <button className="btn btn-success" onClick={startListening}>
          Start Listening
        </button>
        <button
          className="btn btn-danger mx-3 animate__animated animate__fadeIn animate__delay-2s"
          onClick={stopListening}
          disabled={!recognitionInstance}
        >
          Stop Listening
        </button>
        <p className="mt-3">
          <strong>Transcript:</strong>{" "}
          <span className="text-primary">
            {transcript || "No transcript available."}
          </span>
        </p>
      </div>
      <div className="mb-4">
        <h2>Audio File Transcription</h2>
        <div className="mb-3 d-flex align-items-stretch">
          <input
            className="form-control me-2"
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-outline-success"
            onClick={handleTranscription}
            style={{ flexGrow: 0 }}
            // disabled={!audioFile} // Disable button until a file is uploaded
          >
            Transcribe Audio
          </button>
        </div>
        <p className="text-muted mt-2">
          Upload an audio file to generate a text transcription.
        </p>
        {error && <p className="text-danger">{error}</p>}
        {transcript && (
        <div className="mt-3">
          <h3>Transcription:</h3>
          <p>{transcript}</p>
        </div>
      )}
      </div>

      {loading ? (
        <p className="animate__animated animate__flash">Loading data...</p>
      ) : (
        <>
          {/* Saved Tasks */}
          <div className="mb-4">
            <h2>Saved Tasks</h2>
            {savedData.length > 0 ? (
              <ul className="list-group">
                {savedData.map((item) => (
                  <li
                    key={item._id}
                    className="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <EditableText
                      text={item.text}
                      onSave={(updatedText) =>
                        updateData(item._id, updatedText)
                      }
                    />
                    <small className="text-muted d-block mt-1">
                      Saved on: {item.timestamp || "N/A"}
                    </small>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => exportToPDF(item.text, item._id)}
                      >
                        PDF
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => exportToCSV(item.text, item._id)}
                      >
                        CSV
                      </button>
                      <button
                        className="btn btn-outline-success btn-sm"
                        onClick={() => copyToClipboard(item.text)}
                      >
                        Copy
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteData(item._id)}
                        // {deleteConfirmation === item._id ? "Are you sure?" : "Delete"}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">
                No tasks saved yet. Add a new one below!
              </p>
            )}
          </div>
          {/* --------------------------------------------------------------------------------------------------------------- */}
          <div>
            {/* <div className="mt-3">
            <button 
                className="btn btn-primary"
                onClick={() => goToPage(currentPage - 1)} 
                disabled={isPreviousDisabled}
            >
                Previous
            </button>
            <button 
                className="btn btn-primary mx-3" 
                onClick={() => goToPage(currentPage + 1)} 
                disabled={isNextDisabled}
            >
                Next
            </button>
        </div> */}
          </div>
          {/* ----------------------------------------------------------------------------------------------------------- */}
          {/* Add New Data */}
          <div className="mb-4 pt-2">
            <h3 className="t-2">Add New Data</h3>
            <input
              type="text"
              className="form-control pt-2"
              placeholder="Enter new text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
            />
            <button className="btn btn-primary mt-3  pt-2" onClick={addData}>
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const EditableText = ({ text, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentText, setCurrentText] = useState(text);
  const editorRef = useRef(null);
  const quillRef = useRef(null);

  // const recognitionRef = useRef(null);
  // const mediaRecorderRef = useRef(null);
  // const audioChunksRef = useRef([]);
  // const [audioFile, setAudioFile] = useState(null); // For storing the uploaded audio file

  const toolbarOptions = [
    ["bold", "italic", "underline", "strike"],
    ["blockquote", "code-block"],
    ["link", "image", "video", "formula"],
    [{ header: 1 }, { header: 2 }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    [{ size: ["small", false, "large", "huge"] }],
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    ["clean"],
  ];

  useEffect(() => {
    if (isEditing) {
      if (!quillRef.current && editorRef.current) {
        quillRef.current = new Quill(editorRef.current, {
          theme: "snow",
          modules: { toolbar: toolbarOptions },
        });

        quillRef.current.on("text-change", () => {
          setCurrentText(quillRef.current.root.innerHTML);
        });
      }
      console.log("Updating Quill editor content:", currentText);
      if (quillRef.current) {
        quillRef.current.root.innerHTML = currentText;
      }
    } else {
      if (quillRef.current) {
        quillRef.current.off("text-change");
        quillRef.current = null;
      }
    }
  }, [isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    onSave(currentText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setCurrentText(text);
  };

  return isEditing ? (
    <div>
      <div
        ref={editorRef}
        style={{ minHeight: "100px", border: "1px solid #ccc" }}
      />
      <div className="mt-2">
        <button className="btn btn-success btn-sm" onClick={handleSave}>
          Save
        </button>
        <button
          className="btn btn-secondary btn-sm ms-2"
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <span>
      <span dangerouslySetInnerHTML={{ __html: currentText }} />
      <button className="btn btn-link btn-sm ms-2" onClick={handleEdit}>
        Edit
      </button>
    </span>
  );
};

export default Dashboard;
