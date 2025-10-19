import React, { useState, useRef, useEffect } from 'react';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import AwsS3Multipart from '@uppy/aws-s3-multipart';
import '@uppy/core/style.css';
import '@uppy/dashboard/style.css';
import { Camera, Video, VideoOff, Upload, Clock, AlertCircle, CheckCircle, XCircle, Settings } from 'lucide-react';

const ExamPortal = () => {
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:8000');
  const [showSettings, setShowSettings] = useState(false);

  // Exam state
  const [examStarted, setExamStarted] = useState(false);
  const [examTime, setExamTime] = useState(3600); // 60 minutes in seconds
  const [remainingTime, setRemainingTime] = useState(3600);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  // Recording refs
  const screenStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const videoPreviewRef = useRef(null);
  const cameraPreviewRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const recordingIntervalRef = useRef(null);

  // Uppy instance for resumable upload
  const [uppy] = useState(() =>
    new Uppy({
      autoProceed: false,
      restrictions: { maxNumberOfFiles: 1 }
    })
      .use(AwsS3Multipart, {
        companionUrl: apiBaseUrl,
        limit: 2,
        chunkSize: 2 * 1024 * 1024 // 2 MB
      })
  );

  // Format time helper
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Exam timer
  useEffect(() => {
    if (examStarted && remainingTime > 0) {
      timerIntervalRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            handleEndExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [examStarted, remainingTime]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [isRecording]);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: false
      });
      cameraStreamRef.current = stream;
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
      }
      setCameraEnabled(true);
    } catch (err) {
      alert('Failed to access camera: ' + err.message);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraEnabled(false);
  };

  // Start screen recording
  const startRecording = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' },
        audio: true
      });

      screenStreamRef.current = screenStream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = screenStream;
      }

      const options = { mimeType: 'video/webm;codecs=vp9' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }

      const mediaRecorder = new MediaRecorder(screenStream, options);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Uppy handles upload now. No need to call handleUpload.
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      setUploadStatus('Recording...');
    } catch (err) {
      alert('Failed to start recording: ' + err.message);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
  };

  // Remove old upload logic. Uppy handles upload now.

  // Start exam
  const handleStartExam = () => {
    setExamStarted(true);
    setRemainingTime(examTime);
    startCamera();
    startRecording();
  };

  // End exam
  const handleEndExam = () => {
    setExamStarted(false);
    stopRecording();
    stopCamera();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Exam Portal</h1>
              <p className="text-gray-600 mt-1">Online Proctored Examination System</p>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <Settings className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {showSettings && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Base URL
              </label>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="http://localhost:8000"
              />
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Timer */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-700">Time Remaining</span>
              </div>
              <span className={`text-2xl font-bold ${remainingTime < 300 ? 'text-red-600' : 'text-gray-800'}`}>
                {formatTime(remainingTime)}
              </span>
            </div>
          </div>

          {/* Recording Status */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isRecording ? (
                  <Video className="w-5 h-5 text-red-600 animate-pulse" />
                ) : (
                  <VideoOff className="w-5 h-5 text-gray-400" />
                )}
                <span className="font-medium text-gray-700">Recording</span>
              </div>
              <span className="text-2xl font-bold text-gray-800">
                {formatTime(recordingTime)}
              </span>
            </div>
          </div>

          {/* Camera Status */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className={`w-5 h-5 ${cameraEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="font-medium text-gray-700">Camera</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                cameraEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {cameraEnabled ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Exam Area */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Examination Area</h2>

            {!examStarted ? (
              <div className="text-center py-16">
                <AlertCircle className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Ready to Start?</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Before starting the exam, please ensure:
                </p>
                <ul className="text-left max-w-md mx-auto mb-8 space-y-2">
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Your camera is working properly
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    You have a stable internet connection
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Screen recording permission is granted
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    API endpoint is configured correctly
                  </li>
                </ul>
                <button
                  onClick={handleStartExam}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-lg"
                >
                  Start Exam
                </button>
              </div>
            ) : (
              <div>
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Sample Question</h3>
                  <p className="text-gray-700 mb-4">
                    This is a demo exam portal. In a real scenario, exam questions would appear here.
                  </p>
                  <textarea
                    className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Type your answer here..."
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleEndExam}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                  >
                    End Exam
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Monitoring Panel */}
          <div className="space-y-6">
            {/* Camera Feed */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Camera Feed</h3>
              <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                <video
                  ref={cameraPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!cameraEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera className="w-12 h-12 text-gray-600" />
                  </div>
                )}
              </div>
            </div>

            {/* Uppy Dashboard for resumable upload */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Upload (Resumable)</h3>
              <Dashboard
                uppy={uppy}
                width={400}
                height={300}
                proudlyDisplayPoweredByUppy={false}
              />
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Instructions</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Keep your camera on at all times</li>
                <li>• Do not switch tabs or windows</li>
                <li>• Recording will upload automatically</li>
                <li>• Ensure stable internet connection</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamPortal;
