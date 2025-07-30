import React, { useState, useEffect } from 'react';
import { ArrowLeft, Filter, Users, User, Plus, Minus, X, AlertTriangle, ChevronDown, Bell, MessageSquare } from 'lucide-react';
import { supabase, Student, ParticipationLog, ParticipationCategory } from '../lib/supabase';
import AddNoteModal from './AddNoteModal';

interface TrackParticipationPageProps {
  classId: string;
  onNavigateBack: () => void;
}

const TrackParticipationPage: React.FC<TrackParticipationPageProps> = ({ classId, onNavigateBack }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [dailyLogs, setDailyLogs] = useState<ParticipationLog[]>([]);
  const [weeklyLogs, setWeeklyLogs] = useState<ParticipationLog[]>([]);
  const [categories, setCategories] = useState<ParticipationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'daily' | 'weekly' | 'total'>('total');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showPointModal, setShowPointModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedPoints, setSelectedPoints] = useState<number>(0);
  const [selectedIsPositive, setSelectedIsPositive] = useState<boolean>(true);
  const [showNoteModal, setShowNoteModal] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchParticipationLogs();
    fetchCategories();
  }, [classId]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('total_positive_points', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('participation_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchParticipationLogs = async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
      
      // Fetch today's logs
      const { data: todayLogs, error: todayError } = await supabase
        .from('participation_logs')
        .select(`
          *,
          students!inner(id, name, class_id)
        `)
        .eq('students.class_id', classId)
        .gte('created_at', today.toISOString())
        .lt('created_at', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

      if (todayError) throw todayError;
      setDailyLogs(todayLogs || []);

      // Fetch this week's logs
      const { data: weekLogs, error: weekError } = await supabase
        .from('participation_logs')
        .select(`
          *,
          students!inner(id, name, class_id)
        `)
        .eq('students.class_id', classId)
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', now.toISOString());

      if (weekError) throw weekError;
      setWeeklyLogs(weekLogs || []);
    } catch (error) {
      console.error('Error fetching participation logs:', error);
    }
  };

  const getStudentPoints = (studentId: string, period: 'daily' | 'weekly' | 'total') => {
    let logs: ParticipationLog[] = [];
    
    switch (period) {
      case 'daily':
        logs = dailyLogs.filter(log => log.student_id === studentId);
        break;
      case 'weekly':
        logs = weeklyLogs.filter(log => log.student_id === studentId);
        break;
      case 'total':
        // Use the total points from the student record
        const student = students.find(s => s.id === studentId);
        return {
          positive: student?.total_positive_points || 0,
          negative: student?.total_negative_points || 0
        };
    }
    
    const positive = logs.filter(log => log.is_positive).reduce((sum, log) => sum + log.points, 0);
    const negative = logs.filter(log => !log.is_positive).reduce((sum, log) => sum + log.points, 0);
    
    return { positive, negative };
  };

  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student);
    setShowPointModal(true);
  };

  const handlePointSelection = (points: number, isPositive: boolean) => {
    if (isPositive) {
      // For positive points, award immediately
      handleAddPoints(points, isPositive);
    } else {
      // For negative points, show category selection first
      setSelectedPoints(points);
      setSelectedIsPositive(isPositive);
      setShowPointModal(false);
      setShowCategoryModal(true);
    }
  };

  const handleAddPoints = async (points: number, isPositive: boolean, categoryId?: string) => {
    if (!selectedStudent) return;

    try {
      let finalCategoryId = categoryId;
      
      if (!finalCategoryId) {
        // Get a default category if none specified
        const { data: defaultCategories } = await supabase
          .from('participation_categories')
          .select('id')
          .eq('is_positive', isPositive)
          .limit(1);

        if (!defaultCategories || defaultCategories.length === 0) {
          console.error('No categories found');
          return;
        }
        finalCategoryId = defaultCategories[0].id;
      }

      const { error } = await supabase
        .from('participation_logs')
        .insert([
          {
            student_id: selectedStudent.id,
            category_id: finalCategoryId,
            points: points,
            is_positive: isPositive,
          },
        ]);

      if (error) throw error;
      
      // Refresh students to update points
      fetchStudents();
      fetchParticipationLogs();
      setShowPointModal(false);
      setShowCategoryModal(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error adding points:', error);
    }
  };

  const handleAddNote = () => {
    setShowPointModal(false);
    setShowNoteModal(true);
  };

  const handleNoteSaved = () => {
    setShowNoteModal(false);
    setSelectedStudent(null);
    // Refresh students to update any related data
    fetchStudents();
    fetchParticipationLogs();
  };

  const handleCategorySelection = (categoryId: string) => {
    handleAddPoints(selectedPoints, selectedIsPositive, categoryId);
  };

  const getSortedStudents = () => {
    return [...students].sort((a, b) => {
      const aPoints = getStudentPoints(a.id, sortBy);
      const bPoints = getStudentPoints(b.id, sortBy);
      return aPoints.positive - bPoints.positive;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">

      <div className="container mx-auto px-4 py-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={onNavigateBack}
             className="p-3 bg-white rounded-xl hover:bg-gray-50 transition-all border border-gray-200 shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1">
                Track Participation
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm">
                Tap a student to give + points or participation flags
              </p>
            </div>
          </div>
        </div>

        {/* Filter Dropdown */}
        <div className="mb-8">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Filter className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900 font-medium text-sm">View Points:</span>
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'daily' | 'weekly' | 'total')}
                  className="appearance-none bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 pr-8 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
                >
                  <option value="total" className="bg-gray-800">All Time Points</option>
                  <option value="weekly" className="bg-gray-800">This Week</option>
                  <option value="daily" className="bg-gray-800">Today Only</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            
            {/* Info text */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                {sortBy === 'daily' && 'Showing points earned today only. Students with fewer points appear first.'}
                {sortBy === 'weekly' && 'Showing points earned this week. Students with fewer points appear first.'}
                {sortBy === 'total' && 'Showing all-time points. Students with fewer points appear first to help you identify who needs attention.'}
              </p>
            </div>
          </div>
        </div>

        {/* Students Grid */}
        {students.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 glow float">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No students to track</h2>
            <p className="text-gray-600 text-sm">Add students to your class to start tracking participation</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {getSortedStudents().map((student, index) => {
              const points = getStudentPoints(student.id, sortBy);
              
              return (
                <div
                  key={student.id}
                  onClick={() => handleStudentClick(student)}
                  className="bg-white rounded-lg p-4 text-center card-hover cursor-pointer group relative border border-gray-200 shadow-sm aspect-square flex flex-col items-center pt-6 pb-4"
                >
                  {/* Avatar */}
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    {student.photo_url ? (
                      student.photo_url.startsWith('data:text/plain') ? (
                        <span className="text-3xl">
                          {decodeURIComponent(student.photo_url.split(',')[1])}
                        </span>
                      ) : (
                        <img
                          src={student.photo_url}
                          alt={student.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      )
                    ) : (
                      <User className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  
                  {/* Student Name */}
                  <h3 className="text-sm text-gray-600 mt-2 truncate text-center">
                    {student.name.split(' ')[0]}
                  </h3>
                  
                  {/* Points Display */}
                  <div className="flex justify-center items-center space-x-2 mt-2">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 text-xs font-semibold">
                      {points.positive}
                    </span>
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200 text-xs font-semibold">
                      {points.negative}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Point Assignment Modal */}
      {showPointModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                {selectedStudent.photo_url ? (
                  selectedStudent.photo_url.startsWith('data:text/plain') ? (
                    <span className="text-2xl text-white">
                      {decodeURIComponent(selectedStudent.photo_url.split(',')[1])}
                    </span>
                  ) : (
                    <img
                      src={selectedStudent.photo_url}
                      alt={selectedStudent.name}
                      className="w-full h-full rounded-xl object-cover"
                    />
                  )
                ) : (
                  <User className="w-8 h-8 text-white" />
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {selectedStudent.name}
              </h2>
            </div>

            <div className="space-y-6">
              {/* Positive Points */}
              <div>
                <h3 className="text-sm font-bold text-green-600 mb-3 flex items-center justify-center">
                  Give + Points
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 5, 10].map((points) => (
                    <button
                      key={points}
                      onClick={() => handlePointSelection(points, true)}
                      className="py-3 px-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all text-sm font-bold border border-green-300"
                    >
                      +{points}
                    </button>
                  ))}
                </div>
              </div>

              {/* Behavior Alerts */}
              <div>
                <h3 className="text-sm font-bold text-orange-600 mb-3 flex items-center justify-center">
                </h3>
                <button
                  onClick={() => {
                    setSelectedPoints(1);
                    setSelectedIsPositive(false);
                    setShowPointModal(false);
                    setShowCategoryModal(true);
                  }}
                  className="w-full py-4 px-4 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-all text-sm font-bold border border-orange-300"
                >
                  Participation Flags
                </button>
              </div>

              {/* Add Note Section */}
              <div>
                <button
                  onClick={handleAddNote}
                  className="w-full py-4 px-4 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all text-sm font-bold border border-blue-300 flex items-center justify-center space-x-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Add Note</span>
                </button>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  setShowPointModal(false);
                  setSelectedStudent(null);
                }}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold transition-all text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Selection Modal */}
      {showCategoryModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Select Participation Flag</h2>
                  <p className="text-gray-600 text-sm">
                    Flags for {selectedStudent.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedStudent(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {categories
                .filter(category => !category.is_positive)
               .filter(category => category.name !== 'Teacher Note')
                .map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelection(category.id)}
                    className="w-full p-4 text-left bg-orange-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-300 rounded-lg transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-orange-500"
                        style={{ backgroundColor: category.color }}
                      ></div>
                      <div>
                        <h3 className="text-gray-900 font-medium text-sm group-hover:text-orange-800">
                          {category.name}
                        </h3>
                      </div>
                    </div>
                  </button>
                ))}
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedStudent(null);
                }}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold transition-all text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showNoteModal && selectedStudent && (
        <AddNoteModal
          student={selectedStudent}
          onClose={() => {
            setShowNoteModal(false);
            setSelectedStudent(null);
          }}
          onNoteSaved={handleNoteSaved}
        />
      )}
    </div>
  );
};

export default TrackParticipationPage;