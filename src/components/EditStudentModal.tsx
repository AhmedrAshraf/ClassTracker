import React, { useState, useEffect } from 'react';
import { X, User, Camera, Image, Smile } from 'lucide-react';
import { supabase, Student } from '../lib/supabase';

interface EditStudentModalProps {
  student: Student;
  onClose: () => void;
  onStudentUpdated: () => void;
}

const EditStudentModal: React.FC<EditStudentModalProps> = ({ student, onClose, onStudentUpdated }) => {
  const [studentName, setStudentName] = useState(student.name);
  const [photoUrl, setPhotoUrl] = useState(student.photo_url || '');
  const [selectedAvatar, setSelectedAvatar] = useState(
    student.photo_url?.startsWith('data:text/plain') 
      ? decodeURIComponent(student.photo_url.split(',')[1]) 
      : ''
  );
  const [activeInputMethod, setActiveInputMethod] = useState<'none' | 'camera' | 'avatar'>('none');
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Avatar options grouped by category
  const avatarCategories = {
    animals: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮'
    ],
    people: [
      '👦', '👧', '🧒', '👶', '👨‍🎓', '👩‍🎓', '👨‍🏫', '👩‍🏫', '🧑‍🎓', '👨‍💼', '👩‍💼', '🧑‍💼'
    ],
    fun: [
      '🌟', '⭐', '🎯', '🏆', '🎨', '📚', '✏️', '🎭', '🎪', '🎈', '🎉', '🎊'
    ]
  };

  const startCamera = async () => {
    if (stream) {
      stopCamera(); // stop any previous stream
    }

    try {
      setActiveInputMethod('camera');
      setError('');
      setVideoReady(false);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => setVideoReady(true)).catch(() => {
            setError('Unable to start camera preview');
          });
        };
      }
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Unable to access camera. Please check permissions and try again.');
      setActiveInputMethod('none');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    
    if (!video || !stream) {
      setError('Camera not available. Please try again.');
      return;
    }

    // Start video if it's not playing
    if (video.paused) {
      video.play().catch((playError) => {
        console.error('Video play error:', playError);
        setError('Unable to start video. Please try again.');
        return;
      });
    }

    // Check if video has loaded and has dimensions
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Video is still loading. Please wait a moment.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        setError('Unable to create canvas context.');
        stopCamera(); // safety
        return;
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      if (dataUrl && dataUrl !== 'data:,') {
        setPhotoUrl(dataUrl);
        setSelectedAvatar('');
        setError('');
        stopCamera();              // ✅ stops stream and hides black camera view
        setActiveInputMethod('none'); // ✅ hides camera UI (back/cancel/capture)
        setLoading(false);         // ✅ resets button state
      } else {
        setError('Failed to capture photo. Please try again.');
        stopCamera();
        setActiveInputMethod('none');
        setLoading(false);
      }

    } catch (err) {
      console.error('Capture error:', err);
      setError('Failed to capture photo. Please try again.');
      stopCamera();
      setActiveInputMethod('none');
      setLoading(false);
    }
  };
  
  const stopCamera = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (stream) {
      stream.getTracks().forEach((track) => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
      setStream(null);
    }

    setVideoReady(false);
  };
  
  const switchCamera = async () => {
    const newFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(newFacing);
    
    if (stream) {
      stopCamera();
      setCameraFacing(newFacing);
      setTimeout(() => startCamera(), 100);
    }
  };

  const handleAvatarSelect = (avatar: string) => {
    setSelectedAvatar(avatar);
    setPhotoUrl('');
    setActiveInputMethod('avatar');
  };

  // Cleanup camera stream when component unmounts
  useEffect(() => {
    return () => {
      stopCamera(); // ✅ stop camera when modal is closed or component unmounts
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Determine final photo URL - prioritize most recently selected option
      let finalPhotoUrl = null;
      
      if (selectedAvatar) {
        // Avatar was selected
        finalPhotoUrl = `data:text/plain;charset=utf-8,${selectedAvatar}`;
      } else if (photoUrl) {
        // Photo was taken or exists
        finalPhotoUrl = photoUrl;
      }
      
      const { error } = await supabase
        .from('students')
        .update({
          name: studentName,
          photo_url: finalPhotoUrl,
        })
        .eq('id', student.id);

      if (error) throw error;
      onStudentUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to update student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="glass rounded-2xl max-w-md w-full my-4 border border-white/20 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center glow" style={{ backgroundColor: '#34C759' }}>
              <User className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Edit Student</h2>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="studentName" className="block text-xs font-medium text-gray-700 mb-2">
              Student Name
            </label>
            <input
              id="studentName"
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full px-3 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm text-gray-900"
              placeholder="Enter student name"
              required
            />
          </div>

          {/* Photo/Avatar Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-3">
              Student Photo/Avatar (Optional)
            </label>
            
            {/* Camera Instructions */}
           {/* <div className="mb-4 p-3 bg-emerald-100 border border-emerald-300 rounded-lg">
              <h4 className="text-emerald-700 font-medium text-xs mb-2 flex items-center">
                <Camera className="w-3 h-3 mr-1" />
                How to take a photo:
              </h4>
              <ol className="text-xs text-emerald-700 space-y-1">
                <li>1. Click "Take Photo" button</li>
                <li>2. Choose Front or Back camera</li>
                <li>3. Click "Take Photo" button again</li>
                <li>4. Click "Capture" when ready</li>
              </ol>
            </div> */}
            
            {/* Photo Method Selection */}
            <div className="flex space-x-2 mb-4">
              <button
                type="button"
                onClick={startCamera}
                className="flex-1 py-2 px-3 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-all text-xs font-medium border border-emerald-300 flex items-center justify-center space-x-2"
              >
                <Camera className="w-4 h-4" />
                <span>Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveInputMethod('avatar')}
                className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-xs font-medium border border-gray-300 flex items-center justify-center space-x-2"
              >
                <Smile className="w-4 h-4" />
                <span>Choose Avatar</span>
              </button>
            </div>

            {/* Camera View */}
            {activeInputMethod === 'camera' && (
              <div className="mb-4 relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-48 bg-black rounded-lg object-cover"
                />
                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="bg-black/50 text-white p-2 rounded-lg text-xs"
                  >
                    {cameraFacing === 'user' ? '📷 Front' : '📷 Back'}
                  </button>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="bg-red-500/80 text-white px-3 py-2 rounded-lg text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={!videoReady}
                      className="bg-green-500/80 text-white px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
                    >
                      {videoReady ? 'Capture' : 'Loading...'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Current Photo/Avatar Display */}
            {photoUrl || selectedAvatar ? (
              <div className="mb-4">
                <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-green-500/50 bg-white/10 flex items-center justify-center">
                  {photoUrl ? (
                    <img 
                      src={photoUrl} 
                      alt="Student photo" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">{selectedAvatar}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPhotoUrl('');
                    setSelectedAvatar('');
                    setActiveInputMethod('none');
                  }}
                  className="mt-2 text-xs text-gray-400 hover:text-white transition-colors mx-auto block"
                >
                  Remove {photoUrl ? 'Photo' : 'Avatar'}
                </button>
              </div>
            ) : null}

            {/* Avatar Selection */}
            {activeInputMethod === 'avatar' && (
              <div className="space-y-3 max-h-40 overflow-y-auto border border-white/10 rounded-lg p-3 mb-4">
                {Object.entries(avatarCategories).map(([category, avatars]) => (
                  <div key={category}>
                    <h4 className="text-xs font-medium text-gray-600 mb-2 capitalize">
                      {category}
                    </h4>
                    <div className="grid grid-cols-6 gap-2">
                      {avatars.map((avatar, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleAvatarSelect(avatar)}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all ${
                            selectedAvatar === avatar
                              ? 'bg-green-500/30 border-2 border-green-500'
                              : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
                          }`}
                        >
                          {avatar}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
            >
              {loading ? 'Updating...' : 'Update Student'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default EditStudentModal;