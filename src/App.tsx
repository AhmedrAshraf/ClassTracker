import React, { useState } from 'react';
import { useEffect } from 'react';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthForm from './components/AuthForm';
import MainPage from './components/MainPage';
import ClassPage from './components/ClassPage';
import TrackParticipationPage from './components/TrackParticipationPage';
import ReportsPage from './components/ReportsPage';
import SetupAssistantPage from './components/SetupAssistantPage';
import ParticipationFlagsPage from './components/ParticipationFlagsPage';

type Screen = 'main' | 'class' | 'tracking' | 'reports' | 'setup-assistant' | 'participation-flags';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('main');
  const [currentClassId, setCurrentClassId] = useState<string>('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useEffect(() => {
    // Check if this is a password reset callback
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (type === 'recovery' && accessToken) {
      setShowPasswordReset(true);
      // Clear the hash from URL
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleNavigateToClass = (classId: string) => {
    setCurrentClassId(classId);
    setCurrentScreen('class');
  };

  const handleNavigateToTracking = (classId: string) => {
    setCurrentClassId(classId);
    setCurrentScreen('tracking');
  };

  const handleNavigateToReports = () => {
    setCurrentScreen('reports');
  };

  const handleNavigateToSetupAssistant = () => {
    setCurrentScreen('setup-assistant');
  };

  const handleNavigateToParticipationFlags = () => {
    setCurrentScreen('participation-flags');
  };

  const handleNavigateBack = () => {
    if (currentScreen === 'tracking' || currentScreen === 'participation-flags') {
      setCurrentScreen('class');
    } else {
      setCurrentScreen('main');
    }
  };

  const handleNavigateToMain = () => {
    setCurrentScreen('main');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm showPasswordReset={showPasswordReset} onPasswordResetComplete={() => setShowPasswordReset(false)} />;
  }

  switch (currentScreen) {
    case 'class':
      return (
        <ClassPage
          classId={currentClassId}
          onNavigateBack={handleNavigateToMain}
          onNavigateToTracking={handleNavigateToTracking}
          onNavigateToParticipationFlags={handleNavigateToParticipationFlags}
        />
      );
    case 'tracking':
      return (
        <TrackParticipationPage
          classId={currentClassId}
          onNavigateBack={handleNavigateBack}
        />
      );
    case 'participation-flags':
      return (
        <ParticipationFlagsPage
          onNavigateBack={handleNavigateBack}
        />
      );
    case 'reports':
      return (
        <ReportsPage
          onNavigateBack={handleNavigateToMain}
        />
      );
    case 'setup-assistant':
      return (
        <SetupAssistantPage
          onNavigateBack={handleNavigateToMain}
        />
      );
    default:
      return <MainPage onNavigateToClass={handleNavigateToClass} onNavigateToReports={handleNavigateToReports} onNavigateToSetupAssistant={handleNavigateToSetupAssistant} />;
  }
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;