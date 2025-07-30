import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, MessageSquare, Save, Volume2 } from 'lucide-react';
import { supabase, Student } from '../lib/supabase';

interface AddNoteModalProps {
  student: Student;
  onClose: () => void;
  onNoteSaved: () => void;
}

// Extend the Window interface to include webkitSpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const AddNoteModal: React.FC<AddNoteModalProps> = ({ student, onClose, onNoteSaved }) => {
  const [noteText, setNoteText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if speech recognition is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      
      // Initialize speech recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsRecording(true);
        setError('');
        setPermissionDenied(false);
      };
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setNoteText(prev => prev + finalTranscript + ' ');
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        
        if (event.error === 'not-allowed') {
          setPermissionDenied(true);
          setError('Microphone access denied. Please enable microphone permissions and try again.');
        } else if (event.error === 'no-speech') {
          setError('No speech detected. Please try speaking again.');
        } else {
          setError(`Speech recognition error: ${event.error}`);
        }
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognitionRef.current = recognition;
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    if (!recognitionRef.current) return;
    
    try {
      setError('');
      setPermissionDenied(false);
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setError('Failed to start voice recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) {
      setError('Please enter a note or record a voice message.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First, get the "Teacher Note" category ID
      const { data: categories, error: categoryError } = await supabase
        .from('participation_categories')
        .select('id')
        .eq('name', 'Teacher Note')
        .limit(1);

      if (categoryError) throw categoryError;
      
      if (!categories || categories.length === 0) {
        throw new Error('Teacher Note category not found. Please add it to your database first.');
      }

      const categoryId = categories[0].id;

      // Insert the note into participation_logs
      const { error: insertError } = await supabase
        .from('participation_logs')
        .insert([
          {
            student_id: student.id,
            category_id: categoryId,
            points: 0, // Notes don't affect point totals
            is_positive: false, // Matches the category setting
            notes: noteText.trim(),
          },
        ]);

      if (insertError) throw insertError;
      
      onNoteSaved();
    } catch (err: any) {
      console.error('Error saving note:', err);
      if (err.message.includes('Teacher Note category not found')) {
        setError('Teacher Note category not found. Please add the "Teacher Note" category to your database first.');
      } else {
        setError(err.message || 'Failed to save note');
      }
    } finally {
      setLoading(false);
    }
  };

  const clearNote = () => {
    setNoteText('');
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Add Note</h2>
              <p className="text-gray-600 text-sm">For {student.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-xs">{error}</p>
          </div>
        )}

        {permissionDenied && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-700 text-xs">
              To use voice recording, please allow microphone access in your browser settings and refresh the page.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Info text above Voice Recording */}
          <p className="text-xs text-gray-500 mb-2">
            Access notes in Reports & Analytics
          </p>

          {/* Voice Recording Section */}
          {isSupported && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                  <Volume2 className="w-4 h-4 mr-2" />
                  Voice Recording
                </h3>
                <div className="flex space-x-2">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-all flex items-center space-x-1"
                    >
                      <Mic className="w-4 h-4" />
                      <span className="text-xs">Start</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-all flex items-center space-x-1 animate-pulse"
                    >
                      <MicOff className="w-4 h-4" />
                      <span className="text-xs">Stop</span>
                    </button>
                  )}
                </div>
              </div>
              
              {isRecording && (
                <div className="flex items-center space-x-2 text-red-600">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-xs">Recording... Speak now</span>
                </div>
              )}
              
              {!isRecording && noteText && (
                <div className="text-xs text-gray-500">
                  Voice input captured. You can edit the text below or record more.
                </div>
              )}
            </div>
          )}

          {!isSupported && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-yellow-700 text-xs">
                Voice recording is not supported in your browser. You can still type your note below.
              </p>
            </div>
          )}

          {/* Text Input Section */}
          <div>
            <label htmlFor="noteText" className="block text-sm font-medium text-gray-700 mb-2">
              Note Text
            </label>
            <textarea
              id="noteText"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full px-3 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm text-gray-900 resize-none"
              placeholder="Type your note here or use voice recording above..."
              rows={4}
            />
            <div className="flex justify-between items-center mt-2">
              <div></div>
              {noteText && (
                <button
                  type="button"
                  onClick={clearNote}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium transition-all text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNote}
              disabled={loading || !noteText.trim()}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Note</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddNoteModal;