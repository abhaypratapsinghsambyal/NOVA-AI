import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { startCamera } from './camera';
import { callGeminiAPI } from './geminiService';

export default App;



function App() {
  const [capturedImage, setCapturedImage] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [aiStatus, setAiStatus] = useState('idle'); // 'idle', 'listening', 'processing', 'speaking'

  const [audioLevel, setAudioLevel] = useState(0);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const waveformRef = useRef(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [novaVoice, setNovaVoice] = useState(null);
  // Find British female voice
  useEffect(() => {
    function setVoice() {
      const voices = synthRef.current.getVoices();
      console.log('Available voices:', voices.map(v => v.name)); // Log voice names
      // Try to find 'Google UK English Female', fallback to default, then first available
      const preferredVoiceName = "Google UK English Female";
      const preferred = voices.find(v => v.name === preferredVoiceName) || voices.find(v => v.default) || voices[0];
      setNovaVoice(preferred);
      // Set voiceReady to true if any voice was found, even if not the preferred one
      setVoiceReady(voices.length > 0);
      console.log('Preferred voice set:', preferred);
      console.log('Voice ready status:', voices.length > 0);
    }
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = setVoice;
    }
    setVoice();
    console.log('Initial voices:', synthRef.current.getVoices());
  }, []);

  // Start continuous listening
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => setAiStatus('listening');
    recognition.onend = () => setAiStatus('idle');
    recognition.onerror = () => setAiStatus('idle');
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setAiStatus('processing');
      const { aiResponse, capturedImageData } = await fetchGemini(transcript);
      setCapturedImage(capturedImageData);
      speak(aiResponse);
    };
    // Start listening if voice is ready
    if (voiceReady) {
      startListening();
    }

    // eslint-disable-next-line
  }, [voiceReady]);

  // Animate waveform based on audio activity
  function animateWaveform(level) {
    setAudioLevel(level);
    setTimeout(() => setAudioLevel(0), 700);
  }

  function startListening() {
    console.log('startListening called. Current status:', aiStatus);
    if (recognitionRef.current && aiStatus === 'idle') {
      console.log('Recognition starting...');
      try { recognitionRef.current.start(); } catch (e) { console.error(e); setAiStatus('idle'); }
    } else if (recognitionRef.current) {
      console.log('Recognition not starting because status is not idle:', aiStatus);
    } else {
      console.log('Recognition not starting because recognitionRef is null.');
    }
  }

  async function fetchGemini(text) {
    // Use the updated callGeminiAPI function
    return await callGeminiAPI(text);
  }

  function speak(text) {
    console.log('Attempting to speak:', text);
    console.log('voiceReady:', voiceReady);
    console.log('novaVoice:', novaVoice);

    if (!voiceReady || !novaVoice) {
      console.log('Speech synthesis not ready or no voice selected. voiceReady:', voiceReady, 'novaVoice:', novaVoice);
      // Attempt to speak with default voice if preferred not found but voices are available
      if (voiceReady && synthRef.current.getVoices().length > 0) {
        console.log('Attempting to speak with default voice.');
      } else {
        console.log('No voices available to speak.'); // Added log
        return;
      }
    }
    const utter = new window.SpeechSynthesisUtterance(text);
    if (novaVoice) utter.voice = novaVoice;
    utter.rate = 1.02;
    utter.pitch = 1.1;
    utter.onend = () => {
      console.log('Speech synthesis ended. Current status:', aiStatus);
      setIsFadingOut(true); // Start fade out
      setTimeout(() => {
        setCapturedImage(null); // Clear image after fade out
        setIsFadingOut(false); // Reset fade state
        console.log('Attempting to restart listening after timeout. Current status:', aiStatus);
        setAiStatus('idle'); // Set status back to idle before attempting to restart listening
        startListening();
      }, 500); // Match CSS transition duration (0.5s)
    };
    utter.onerror = (event) => { // Added error handler
      console.error('Speech synthesis error:', event.error); // Log speech synthesis errors
      setAiStatus('idle'); // Set status back to idle on error
      startListening(); // Attempt to restart listening
    };
    console.log('Calling synthRef.current.speak with utter:', utter); // Added log before speak call
    synthRef.current.speak(utter);
    setAiStatus('speaking');
    animateWaveform(1);
  }

  // Start camera on component mount
  useEffect(() => {
    startCamera();
  }, []);

  // No visible chat or text output
  return (
    <div className="nova-container">
      <div className={`nova-bg ${aiStatus}`}>
      <div className="nova-center">
        <div className={`nova-waveform ${aiStatus}`} ref={waveformRef} style={{ boxShadow: `0 0 ${40 + audioLevel * 60}px 10px #00fff7, 0 0 ${80 + audioLevel * 120}px 30px #00fff7` }}>
          <svg width="240" height="240" viewBox="0 0 240 240">
            <circle cx="120" cy="120" r={90 + audioLevel * 20} fill="none" stroke="#00fff7" strokeWidth="6" opacity="0.7" />
            <circle cx="120" cy="120" r={60 + audioLevel * 10} fill="none" stroke="#00fff7" strokeWidth="3" opacity="0.3" />
            <circle cx="120" cy="120" r={30 + audioLevel * 5} fill="none" stroke="#00fff7" strokeWidth="2" opacity="0.2" />
          </svg>
          <span className="nova-title">NOVA</span>
        </div>
        <div className="nova-mic-glow" style={{ opacity: aiStatus === 'listening' ? 1 : 0.3 }} />
      </div>
      {capturedImage && (aiStatus === 'speaking' || isFadingOut) && (
        <img src={capturedImage} alt="Captured from camera" className={`camera-popup-image ${isFadingOut ? 'fade-out' : ''}`} />
      )}
    </div>
    </div>
  );
}
