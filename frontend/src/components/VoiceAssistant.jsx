import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Mic, MicOff, Volume2 } from 'lucide-react';

const VoiceAssistant = ({ API_URL, onTaskActionExecuted, agentName = 'Ayra' }) => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [assistantText, setAssistantText] = useState('');
  const [statusText, setStatusText] = useState('Click the sphere to start talking.');
  
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const speechTimeoutMs = 5000; // 5 seconds silence pause detection
  const isListeningRef = useRef(isListening);
  const shouldRestartRef = useRef(true);
  const accumulatedTextRef = useRef('');
  const transcriptRef = useRef('');
  const sessionStartIndexRef = useRef(0);

  // Sync isListening with isListeningRef
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Text to Speech
  const speak = (text, onEndCallback) => {
    setAssistantText(text);
    // Cancel any current speaking
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    if (onEndCallback) {
      utterance.onend = onEndCallback;
    }
    // Find a voice matching preference if possible, otherwise use default
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      // Find a female voice for Ayra, male for Jordan, or just default
      const preferredVoice = voices.find(v => 
        agentName === 'Ayra' 
          ? v.name.includes('Google US English') || v.name.includes('Zira') || v.name.includes('Female')
          : v.name.includes('David') || v.name.includes('Male') || v.name.includes('Google UK English')
      );
      if (preferredVoice) utterance.voice = preferredVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    // Initialize SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusText('Web Speech API is not supported in this browser. Please use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event) => {
      resetSilenceTimer();

      let currentSessionTranscript = '';
      for (let i = sessionStartIndexRef.current; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          accumulatedTextRef.current = (accumulatedTextRef.current + ' ' + event.results[i][0].transcript).trim();
          sessionStartIndexRef.current = i + 1;
        } else {
          currentSessionTranscript += event.results[i][0].transcript;
        }
      }
      
      const fullText = (accumulatedTextRef.current + ' ' + currentSessionTranscript).trim();
      setTranscript(fullText);
      transcriptRef.current = fullText;
    };

    recognition.onerror = (err) => {
      if (err.error === 'aborted') {
        return; // Ignore programmatic aborts
      }
      console.error("Speech Recognition Error:", err);
      if (err.error === 'not-allowed') {
        setStatusText("Microphone access denied. Please enable microphone permissions.");
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if we are supposed to be listening and not paused for confirmation
      if (isListeningRef.current && shouldRestartRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.warn("Error restarting speech recognition, retrying in 250ms...", e);
          setTimeout(() => {
            if (isListeningRef.current && shouldRestartRef.current) {
              try {
                recognition.start();
              } catch (retryErr) {
                console.error("Error in retry restarting speech recognition:", retryErr);
              }
            }
          }, 250);
        }
      }
    };

    recognitionRef.current = recognition;
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []); // Run only once on mount

  // Load SpeechSynthesis voices
  useEffect(() => {
    const loadVoices = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    loadVoices();
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    silenceTimerRef.current = setTimeout(() => {
      handleSilenceDetected();
    }, speechTimeoutMs);
  };

  const startAssistant = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Please try Google Chrome.");
      return;
    }

    isListeningRef.current = true;
    shouldRestartRef.current = true;
    accumulatedTextRef.current = '';
    transcriptRef.current = '';
    sessionStartIndexRef.current = 0;
    
    setIsListening(true);
    setTranscript('');
    setAssistantText('');
    setStatusText('Listening for your voice tasks...');
    
    try {
      recognitionRef.current.start();
      speak(`I am ${agentName}, your personal assistant. Go ahead, list your tasks.`, () => {
        resetSilenceTimer();
      });
    } catch (e) {
      console.error("Error starting speech:", e);
    }
  };

  const stopAssistant = () => {
    isListeningRef.current = false;
    shouldRestartRef.current = false;
    
    setIsListening(false);
    setStatusText('Stopped listening.');
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // Silence detected - prompt user
  const handleSilenceDetected = () => {
    if (!recognitionRef.current) return;
    
    console.log("Silence detected. Asking user if there is anything left...");
    
    // Save current transcript before stopping to avoid losing it when starting confirmation
    accumulatedTextRef.current = transcriptRef.current;
    
    shouldRestartRef.current = false; // Prevent auto-restart in onend
    recognitionRef.current.stop(); // Pause standard speech recognition while speaking
    
    setStatusText('Waiting for response: "Yes" or "No"...');

    speak("Is there anything left, Sir or Ma'am?", () => {
      listenForYesNoConfirmation();
    });
  };

  // Short listener to grab quick confirmation
  const listenForYesNoConfirmation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    let hasHandled = false;
    const startTime = Date.now();
    const maxWaitMs = 8000; // Allow up to 8 seconds for confirmation

    const runConfirmRec = () => {
      const confirmRec = new SpeechRecognition();
      confirmRec.lang = navigator.language || 'en-US';
      confirmRec.interimResults = false;
      confirmRec.maxAlternatives = 1;

      confirmRec.onresult = async (event) => {
        if (hasHandled) return;
        hasHandled = true;

        try {
          confirmRec.stop();
        } catch (err) {}

        const answer = event.results[0][0].transcript.toLowerCase();
        console.log(`Confirmation response received: "${answer}"`);

        const normalizedAnswer = answer.trim();
        
        const isNo = normalizedAnswer.includes("no") || 
                     normalizedAnswer.includes("nothing") || 
                     normalizedAnswer.includes("that's it") || 
                     normalizedAnswer.includes("stop") || 
                     normalizedAnswer.includes("finish") ||
                     normalizedAnswer.includes("nope") ||
                     normalizedAnswer.includes("nah");

        const isYes = normalizedAnswer.includes("yes") || 
                      normalizedAnswer.includes("yeah") || 
                      normalizedAnswer.includes("yep") || 
                      normalizedAnswer.includes("sure") || 
                      normalizedAnswer.includes("ok");

        if (isYes) {
          setStatusText("Listening again...");
          speak("Alright, continuing to list your tasks.", () => {
            if (isListeningRef.current) {
              shouldRestartRef.current = true;
              sessionStartIndexRef.current = 0;
              setTimeout(() => {
                try {
                  console.log("Restarting main recognition after yes confirmation...");
                  recognitionRef.current.start();
                  resetSilenceTimer();
                } catch (err) {
                  console.error("Error restarting main recognition:", err);
                }
              }, 150);
            }
          });
        } else if (isNo) {
          speak("Understood. Processing your schedule.");
          await processVoiceSession();
        } else {
          // User spoke a task directly!
          const updatedTranscript = (accumulatedTextRef.current + ' ' + answer).trim();
          setTranscript(updatedTranscript);
          transcriptRef.current = updatedTranscript;
          accumulatedTextRef.current = updatedTranscript;
          
          setStatusText("Listening again...");
          speak("Alright, adding that.", () => {
            if (isListeningRef.current) {
              shouldRestartRef.current = true;
              sessionStartIndexRef.current = 0;
              setTimeout(() => {
                try {
                  console.log("Restarting main recognition after direct task...");
                  recognitionRef.current.start();
                  resetSilenceTimer();
                } catch (err) {
                  console.error("Error restarting main recognition:", err);
                }
              }, 150);
            }
          });
        }
      };

      confirmRec.onerror = async (e) => {
        if (hasHandled) return;

        const elapsed = Date.now() - startTime;
        if (e && (e.error === 'no-speech' || e.error === 'aborted') && elapsed < maxWaitMs) {
          console.log(`confirmRec no-speech/aborted, retrying (elapsed: ${elapsed}ms)...`);
          try {
            confirmRec.stop();
          } catch (err) {}
          
          setTimeout(() => {
            if (!hasHandled) runConfirmRec();
          }, 100);
          return;
        }

        hasHandled = true;
        console.log("No confirmation speech heard. Defaulting to processing.");
        speak("Processing your tasks.");
        await processVoiceSession();
      };

      try {
        confirmRec.start();
      } catch (err) {
        console.warn("confirmRec start failed, retrying in 250ms...", err);
        setTimeout(() => {
          if (!hasHandled) {
            try {
              confirmRec.start();
            } catch (retryErr) {
              console.error("confirmRec retry start failed:", retryErr);
            }
          }
        }, 250);
      }
    };

    runConfirmRec();
  };

  // Submit transcript to server
  const processVoiceSession = async () => {
    stopAssistant();
    setStatusText('Saving tasks to database...');

    try {
      const currentText = transcriptRef.current;
      if (!currentText || currentText.trim() === '') {
        speak("I didn't catch any tasks. Let me know when you're ready.");
        setStatusText('Session ended. No text to process.');
        return;
      }

      // 1. Process voice intents on backend
      const res = await axios.post(`${API_URL}/api/voice/process`, { rawText: currentText }, { withCredentials: true });
      console.log("Voice process output:", res.data);
      
      // Update tasks list UI
      if (onTaskActionExecuted) onTaskActionExecuted();

      // 2. Check for yesterday's uncompleted tasks
      const prevCheck = await axios.get(`${API_URL}/api/tasks/check-previous-day`, { withCredentials: true });
      const { unfinishedCount } = prevCheck.data;

      if (unfinishedCount > 0) {
        setStatusText('Roll over yesterday\'s tasks? Speak "Yes" or "No".');
        speak(`You have ${unfinishedCount} unfinished tasks from yesterday. Would you like to roll them over to today?`, () => {
          listenForRolloverConfirmation();
        });
      } else {
        speak("Hello, you have completed all your yesterday's task, congratulations!");
        setStatusText('All tasks finished! Congratulations.');
      }
    } catch (err) {
      console.error("Error processing voice session:", err);
      setStatusText('Error processing session.');
      speak("Sorry, there was an error processing your tasks.");
    }
  };

  // Roll over confirmation
  const listenForRolloverConfirmation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    let hasHandled = false;
    const startTime = Date.now();
    const maxWaitMs = 8000; // Allow up to 8 seconds for confirmation

    const runRolloverRec = () => {
      const rolloverRec = new SpeechRecognition();
      rolloverRec.lang = navigator.language || 'en-US';

      rolloverRec.onresult = async (event) => {
        if (hasHandled) return;
        hasHandled = true;

        try {
          rolloverRec.stop();
        } catch (err) {}

        const answer = event.results[0][0].transcript.toLowerCase();
        console.log(`Rollover answer: "${answer}"`);

        if (answer.includes("yes")) {
          try {
            speak("Rolling tasks over to today.");
            setStatusText("Rolling tasks over...");
            await axios.post(`${API_URL}/api/tasks/rollover`, {}, { withCredentials: true });
            if (onTaskActionExecuted) onTaskActionExecuted();
            speak("Tasks successfully rolled over to today's view.");
            setStatusText("Tasks rolled over!");
          } catch (e) {
            console.error("Rollover failed:", e);
            speak("Failed to roll over tasks.");
          }
        } else {
          speak("Alright, keeping yesterday's tasks as is.");
          setStatusText("Rollover cancelled.");
        }
      };

      rolloverRec.onerror = (e) => {
        if (hasHandled) return;

        const elapsed = Date.now() - startTime;
        if (e && (e.error === 'no-speech' || e.error === 'aborted') && elapsed < maxWaitMs) {
          console.log(`rolloverRec no-speech/aborted, retrying (elapsed: ${elapsed}ms)...`);
          try {
            rolloverRec.stop();
          } catch (err) {}
          
          setTimeout(() => {
            if (!hasHandled) runRolloverRec();
          }, 100);
          return;
        }

        hasHandled = true;
        speak("Alright, keeping yesterday's tasks as is.");
        setStatusText("Rollover cancelled.");
      };

      try {
        rolloverRec.start();
      } catch (err) {
        console.warn("rolloverRec start failed, retrying in 250ms...", err);
        setTimeout(() => {
          if (!hasHandled) {
            try {
              rolloverRec.start();
            } catch (retryErr) {
              console.error("rolloverRec retry start failed:", retryErr);
            }
          }
        }, 250);
      }
    };

    runRolloverRec();
  };

  return (
    <div className="glass-panel voice-assistant-panel" style={{ height: '100%' }}>
      <h3 style={{ fontSize: '1.4rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Voice Assistant AI
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Talk naturally. {agentName} will extract tasks and automatically group them.
      </p>

      {/* Pulsing Assistant Sphere */}
      <div 
        className={`assistant-sphere ${isListening ? 'listening' : ''}`}
        onClick={isListening ? stopAssistant : startAssistant}
      >
        {isListening ? (
          <MicOff size={44} color="#fff" />
        ) : (
          <Mic size={44} color="#fff" />
        )}
      </div>

      <div className="soundwave-container">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="soundwave-bar" />
        ))}
      </div>

      <div style={{ margin: '12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: 600 }}>
        {statusText}
      </div>

      {transcript && (
        <div style={{ width: '100%', textAlign: 'left', marginTop: '10px' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
            Live Transcript
          </div>
          <div className="live-transcript-box">
            {transcript}
          </div>
        </div>
      )}

      {assistantText && (
        <div style={{ width: '100%', textAlign: 'left', marginTop: '16px', borderLeft: '3px solid var(--accent-purple)', paddingLeft: '12px' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-purple)', fontWeight: 700, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Volume2 size={12} /> {agentName}
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '4px' }}>
            {assistantText}
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;
