import React, { useState, useEffect } from 'react';
import { Plus, Settings, Users, BookOpen, ArrowRight, LogOut, Shield, MoreVertical, Edit, Trash2, Sparkles, BarChart3, RotateCcw, X, UserX, AlertTriangle, HelpCircle, ChevronDown, Menu, Key, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Class } from '../lib/supabase';
import AddClassModal from './AddClassModal';
import EditClassModal from './EditClassModal';
import ChangePasswordModal from './ChangePasswordModal';
import ContactFeedbackModal from './ContactFeedbackModal';

interface MainPageProps {
  onNavigateToClass: (classId: string) => void;
  onNavigateToReports: () => void;
  onNavigateToSetupAssistant: () => void;
}

const MainPage: React.FC<MainPageProps> = ({ onNavigateToClass, onNavigateToReports, onNavigateToSetupAssistant }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddClass, setShowAddClass] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [classToDelete, setClassToDelete] = useState<Class | null>(null);
  const [classToReset, setClassToReset] = useState<Class | null>(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showContactFeedback, setShowContactFeedback] = useState(false);
  const { user, teacherName, signOut } = useAuth();

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClasses(data || []);

      // Fetch student counts for each class
      if (data) {
        const counts: Record<string, number> = {};
        for (const classItem of data) {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', classItem.id);
          counts[classItem.id] = count || 0;
        }
        setStudentCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClassAdded = () => {
    setShowAddClass(false);
    fetchClasses();
  };

  const handleClassUpdated = () => {
    setEditingClass(null);
    fetchClasses();
  };

  const handleDeleteClass = async (classId: string) => {
    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId);

      if (error) throw error;
      fetchClasses();
      setClassToDelete(null);
    } catch (error) {
      console.error('Error deleting class:', error);
    }
  };

  const handleResetClassPoints = async (classId: string, className: string) => {
    const classToReset = classes.find(c => c.id === classId);
    if (classToReset) {
      setClassToReset(classToReset);
    }
  };

  const confirmResetClassPoints = async (classId: string, className: string) => {
    try {
      // Get all students in this class
      const { data: classStudents, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classId);

      if (studentsError) throw studentsError;

      if (classStudents && classStudents.length > 0) {
        const studentIds = classStudents.map(s => s.id);

        // Delete all participation logs for students in this class
        const { error: deleteError } = await supabase
          .from('participation_logs')
          .delete()
          .in('student_id', studentIds);

        if (deleteError) throw deleteError;

        // Reset all students' point totals in this class
        const { error: updateError } = await supabase
          .from('students')
          .update({
            total_positive_points: 0,
            total_negative_points: 0,
            updated_at: new Date().toISOString()
          })
          .eq('class_id', classId);

        if (updateError) throw updateError;
      }

      fetchClasses();
      setClassToReset(null);
    } catch (error) {
      console.error('Error resetting class points:', error);
      setClassToReset(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const getDisplayName = () => {
    if (teacherName) {
      return teacherName;
    }
    return user?.email?.split('@')[0] || 'Teacher';
  };

  const handleClassCardClick = (classId: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on dropdown or its buttons
    if ((e.target as HTMLElement).closest('.dropdown-menu')) {
      return;
    }
    onNavigateToClass(classId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading your classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">

      <div className="container mx-auto px-4 py-6 relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 ml-3">TapTivo</span>
            </h1>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 bg-white rounded-xl hover:bg-gray-50 transition-all border border-gray-200 shadow-sm"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
            {showSettings && (
              <div className="absolute right-0 mt-2 w-48 bg-white backdrop-blur-sm rounded-xl border border-gray-200 z-20 shadow-xl">
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowChangePasswordModal(true);
                      setShowSettings(false);
                    }}
                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all text-sm"
                  >
                    <Key className="w-5 h-5" />
                    <span>Change Password</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowContactFeedback(true);
                      setShowSettings(false);
                    }}
                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all text-sm"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>Contact & Feedback</span>
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all text-sm"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                  <button 
                    onClick={() => {
                      setShowDeleteAccount(true);
                      setShowSettings(false);
                    }}
                    className="w-full px-4 py-3 text-left text-red-400 hover:bg-red-500/20 flex items-center space-x-3 transition-all text-sm"
                  >
                    <UserX className="w-5 h-5" />
                    <span>Delete Account</span>
                  </button>
                  <button 
                    onClick={() => {
                      setShowPrivacyPolicy(true);
                      setShowSettings(false);
                    }}
                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all text-sm"
                  >
                    <Shield className="w-5 h-5" />
                    <span>Privacy Policy</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={() => setShowAddClass(true)}
            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 glow hover:from-green-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-2xl border-2 border-green-400/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Class</span>
          </button>

          {/* Desktop buttons - hidden on mobile */}
          <div className="hidden sm:flex gap-4">
            <button
              onClick={onNavigateToReports}
             className="bg-gray-200 hover:bg-gray-300 border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-800 px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 text-sm shadow-none"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Reports & Analytics</span>
            </button>

            <button
              onClick={onNavigateToSetupAssistant}
             className="bg-gray-200 hover:bg-gray-300 border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-800 px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 text-sm shadow-none"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Setup Assistant</span>
            </button>
          </div>

          {/* Mobile dropdown - shown only on mobile */}
          <div className="sm:hidden relative">
            <button
              onClick={() => setShowActionsDropdown(!showActionsDropdown)}
             className="w-full btn-secondary px-6 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center space-x-2"
            >
              <Menu className="w-4 h-4" />
              <span>More Actions</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showActionsDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showActionsDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white backdrop-blur-sm rounded-xl border border-gray-200 z-20 shadow-xl">
                <div className="py-2">
                  <button
                    onClick={() => {
                      onNavigateToReports();
                      setShowActionsDropdown(false);
                    }}
                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all text-sm rounded-lg"
                  >
                    <BarChart3 className="w-5 h-5" />
                    <span>Reports & Analytics</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigateToSetupAssistant();
                      setShowActionsDropdown(false);
                    }}
                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all text-sm rounded-lg"
                  >
                    <HelpCircle className="w-5 h-5" />
                    <span>Setup Assistant</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Classes Grid */}
        {classes.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6 float">
              <BookOpen className="w-8 h-8" style={{ color: '#34C759' }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No classes yet</h2>
            <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">Create your first class to start tracking participation and engaging with your students</p>
            <button
              onClick={() => setShowAddClass(true)}
              className="btn-primary px-6 py-3 rounded-lg font-semibold text-sm"
            >
              Create Your First Class
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((classItem) => (
              <div
                key={classItem.id}
                onClick={(e) => handleClassCardClick(classItem.id, e)}
                className="bg-white rounded-lg p-6 cursor-pointer card-hover relative group border border-gray-200 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6" style={{ color: '#34C759' }} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
                    <div className="relative dropdown-menu">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDropdown(showDropdown === classItem.id ? null : classItem.id);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {showDropdown === classItem.id && (
                        <div className="absolute right-0 mt-1 w-44 bg-white backdrop-blur-sm rounded-xl border border-gray-200 z-20 shadow-xl">
                          <div className="py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingClass(classItem);
                                setShowDropdown(null);
                              }}
                              className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all text-sm"
                            >
                              <Edit className="w-4 h-4" />
                              <span>Edit Class</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                               handleResetClassPoints(classItem.id, classItem.name);
                                setShowDropdown(null);
                              }}
                              className="w-full px-4 py-3 text-left text-orange-400 hover:bg-orange-500/20 flex items-center space-x-3 transition-all text-sm"
                            >
                              <RotateCcw className="w-4 h-4" />
                              <span>Reset All Points</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setClassToDelete(classItem);
                                setShowDropdown(null);
                              }}
                              className="w-full px-4 py-3 text-left text-red-400 hover:bg-red-500/20 flex items-center space-x-3 transition-all text-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete Class</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  {classItem.name}
                </h3>
                
                <div className="flex items-center justify-between text-xs text-gray-600 mb-4">
                  <div className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded-lg">
                    <Users className="w-3 h-3" />
                    <span>{studentCounts[classItem.id] || 0} students</span>
                  </div>
                </div>
                
                <p className="text-gray-500 text-xs">
                  {studentCounts[classItem.id] === 0 
                    ? "Tap here to add students and track participation"
                    : "Tap here to manage students and track participation"
                  }
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Class Modal */}
      {showAddClass && (
        <AddClassModal
          onClose={() => setShowAddClass(false)}
          onClassAdded={handleClassAdded}
        />
      )}

      {/* Edit Class Modal */}
      {editingClass && (
        <EditClassModal
          classData={editingClass}
          onClose={() => setEditingClass(null)}
          onClassUpdated={handleClassUpdated}
        />
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center glow">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-green-800">Privacy Policy</h2>
              </div>
              <button
                onClick={() => setShowPrivacyPolicy(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 text-gray-700 text-sm">
              <div>
                <h3 className="text-gray-900 font-semibold mb-2">Data Collection and Use</h3>
                <p>
                  The Teacher Participation Tracker collects and stores information you provide, including:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Your account information (name and email)</li>
                  <li>Class names and details you create</li>
                  <li>Student names and optional photo URLs</li>
                  <li>Participation points and activity logs</li>
                </ul>
                <p className="mt-2">
                  This data is used solely to provide the participation tracking service and generate reports for your educational purposes.
                </p>
              </div>

              <div>
                <h3 className="text-gray-900 font-semibold mb-2">Data Security</h3>
                <p>
                  Your data is stored securely using Supabase's enterprise-grade infrastructure with:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>End-to-end encryption for data transmission</li>
                  <li>Row-level security ensuring you can only access your own data</li>
                  <li>Regular security updates and monitoring</li>
                  <li>Secure authentication protocols</li>
                </ul>
              </div>

              <div>
                <h3 className="text-gray-900 font-semibold mb-2">Data Sharing</h3>
                <p>
                  We do not sell, trade, or share your personal information with third parties. Your student data and participation records remain private and are only accessible to you through your authenticated account.
                </p>
              </div>

              <div>
                <h3 className="text-gray-900 font-semibold mb-2">Data Retention</h3>
                <p>
                  Your data is retained as long as your account remains active. You can delete individual students, classes, or your entire account at any time. When you delete data, it is permanently removed from our systems.
                </p>
              </div>

              <div>
                <h3 className="text-gray-900 font-semibold mb-2">Student Privacy</h3>
                <p>
                  We understand the importance of student privacy in educational settings:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Student photos are optional and stored as URLs you provide</li>
                  <li>No personal student information beyond names is collected</li>
                  <li>Participation data is used only for educational assessment</li>
                  <li>You maintain full control over all student data</li>
                </ul>
              </div>

              <div>
                <h3 className="text-gray-900 font-semibold mb-2">Your Rights</h3>
                <p>You have the right to:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Access all data associated with your account</li>
                  <li>Export your data in CSV format</li>
                  <li>Delete individual records or your entire account</li>
                  <li>Request clarification about our data practices</li>
                </ul>
              </div>

              <div>
                <h3 className="text-gray-900 font-semibold mb-2">Compliance</h3>
                <p>
                  This application is designed with educational privacy in mind and follows best practices for protecting student information. We recommend reviewing your institution's policies regarding student data management.
                </p>
              </div>

              <div>
                <h3 className="text-gray-900 font-semibold mb-2">Contact</h3>
                <p>
                  If you have questions about this privacy policy or how your data is handled, please contact your system administrator or the application developer.
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-xs text-gray-400">
                  Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowPrivacyPolicy(false)}
                className="w-full btn-primary py-3 px-4 rounded-lg font-semibold transition-all text-sm"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteAccount && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl max-w-md w-full p-6 border border-red-500/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center glow">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-white">Delete Account</h2>
              </div>
              <button
                onClick={() => {
                  setShowDeleteAccount(false);
                  setDeleteConfirmText('');
                }}
                className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-gray-300 text-sm mb-6">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <h3 className="text-red-400 font-semibold mb-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Warning: This action cannot be undone!
                </h3>
                <p className="text-red-300 text-xs">
                  Deleting your account will permanently remove all your data from our servers.
                </p>
              </div>

              <p>
                This will delete all your classes, students, and participation data. To confirm, please type{' '}
                <span className="font-mono bg-white/10 px-2 py-1 rounded text-red-400">DELETE</span>{' '}
                in the field below:
              </p>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-400 transition-colors"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteAccount(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirmText !== 'DELETE') return;
                  
                  setDeletingAccount(true);
                  try {
                    // Delete user data from our custom tables first
                    const { error: deleteError } = await supabase.rpc('delete_user_data');
                    if (deleteError) throw deleteError;

                    // Sign out and let auth handle the rest
                    await signOut();
                  } catch (error) {
                    console.error('Error deleting account:', error);
                    alert('There was an error deleting your account. Please try again.');
                  } finally {
                    setDeletingAccount(false);
                  }
                }}
                disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {deletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Class Confirmation Modal */}
      {classToDelete && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl max-w-md w-full p-6 border border-red-500/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center glow">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Delete Class</h2>
              </div>
              <button
                onClick={() => setClassToDelete(null)}
                className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 text-center mb-3">
                Are you sure you want to delete <span className="font-bold text-red-400">{classToDelete.name}</span>?
              </p>
              <p className="text-gray-400 text-sm text-center">
                This will also delete all students and participation data for this class.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setClassToDelete(null)}
                className="flex-1 btn-secondary py-3 px-4 rounded-lg font-semibold transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteClass(classToDelete.id)}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition-all text-sm"
              >
                Delete Class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Class Points Confirmation Modal */}
      {classToReset && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl max-w-md w-full p-6 border border-orange-500/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center glow">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Reset All Points</h2>
              </div>
              <button
                onClick={() => setClassToReset(null)}
                className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 text-center mb-3">
                Are you sure you want to reset ALL points for <span className="font-bold text-orange-400">{classToReset.name}</span>?
              </p>
              <p className="text-gray-400 text-sm text-center">
                This will delete all participation data and set all student points to zero. This action cannot be undone.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setClassToReset(null)}
                className="flex-1 btn-secondary py-3 px-4 rounded-lg font-semibold transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmResetClassPoints(classToReset.id, classToReset.name)}
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all text-sm"
              >
                Reset All Points
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowChangePasswordModal(false)}
        />
      )}

      {/* Contact & Feedback Modal */}
      {showContactFeedback && (
        <ContactFeedbackModal
          onClose={() => setShowContactFeedback(false)}
        />
      )}

    </div>
  );
};

export default MainPage;