import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Users, Target, BarChart3, MoreVertical, Edit, Trash2, User, RotateCcw, AlertTriangle, X, Bell, Filter, ChevronDown, HelpCircle } from 'lucide-react';
import { supabase, Class, Student, ParticipationLog } from '../lib/supabase';
import AddStudentModal from './AddStudentModal';
import EditStudentModal from './EditStudentModal';

interface ClassPageProps {
  classId: string;
  onNavigateBack: () => void;
  onNavigateToTracking: (classId: string) => void;
  onNavigateToParticipationFlags: () => void;
}

const ClassPage: React.FC<ClassPageProps> = ({ classId, onNavigateBack, onNavigateToTracking, onNavigateToParticipationFlags }) => {
  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [participationLogs, setParticipationLogs] = useState<ParticipationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [studentToReset, setStudentToReset] = useState<Student | null>(null);
  const [sortBy, setSortBy] = useState<'positive' | 'negative'>('positive');
  const [dateFilter, setDateFilter] = useState<'total' | 'today' | 'weekly' | 'custom'>('total');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    fetchClassData();
    fetchStudentsAndLogs();
  }, [classId]);

  const fetchClassData = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (error) throw error;
      setClassData(data);
    } catch (error) {
      console.error('Error fetching class data:', error);
    }
  };

  const fetchStudentsAndLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('name');

      if (error) throw error;
      setStudents(data || []);

      // Fetch participation logs for all students in this class
      if (data && data.length > 0) {
        const studentIds = data.map(s => s.id);
        const { data: logsData, error: logsError } = await supabase
          .from('participation_logs')
          .select('*')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false });

        if (logsError) throw logsError;
        setParticipationLogs(logsData || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (filterType: 'total' | 'today' | 'weekly' | 'custom') => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filterType) {
      case 'today':
        return {
          start: today.toISOString(),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        };
      case 'weekly':
        const weekStart = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
        return {
          start: weekStart.toISOString(),
          end: now.toISOString()
        };
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate).toISOString(),
            end: new Date(customEndDate + 'T23:59:59').toISOString()
          };
        }
        return null;
      case 'total':
      default:
        return null;
    }
  };

  const getStudentPointsForPeriod = (studentId: string) => {
    const dateRange = getDateRange(dateFilter);
    
    if (dateFilter === 'total') {
      // Use the total points from the student record
      const student = students.find(s => s.id === studentId);
      return {
        positive: student?.total_positive_points || 0,
        negative: student?.total_negative_points || 0
      };
    }
    
    if (!dateRange) {
      return { positive: 0, negative: 0 };
    }
    
    const filteredLogs = participationLogs.filter(log => 
      log.student_id === studentId &&
      log.created_at >= dateRange.start && 
      log.created_at <= dateRange.end
    );
    
    const positive = filteredLogs.filter(log => log.is_positive).reduce((sum, log) => sum + log.points, 0);
    const negative = filteredLogs.filter(log => !log.is_positive).reduce((sum, log) => sum + log.points, 0);
    
    return { positive, negative };
  };

  const getSortedStudents = () => {
    return [...students].sort((a, b) => {
      const aPoints = getStudentPointsForPeriod(a.id);
      const bPoints = getStudentPointsForPeriod(b.id);
      
      const aValue = sortBy === 'positive' ? aPoints.positive : aPoints.negative;
      const bValue = sortBy === 'positive' ? bPoints.positive : bPoints.negative;
      
      return bValue - aValue; // Highest first
    });
  };

  const handleStudentAdded = () => {
    setShowAddStudent(false);
    fetchStudentsAndLogs();
  };

  const handleStudentUpdated = () => {
    setEditingStudent(null);
    fetchStudentsAndLogs();
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);

      if (error) throw error;
      fetchStudentsAndLogs();
      setStudentToDelete(null);
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  };

  const handleResetStudentPoints = async (studentId: string, studentName: string) => {
    try {
      // Delete all participation logs for this student
      const { error: deleteError } = await supabase
        .from('participation_logs')
        .delete()
        .eq('student_id', studentId);

      if (deleteError) throw deleteError;

      // Reset the student's point totals
      const { error: updateError } = await supabase
        .from('students')
        .update({
          total_positive_points: 0,
          total_negative_points: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', studentId);

      if (updateError) throw updateError;

      fetchStudentsAndLogs();
      setStudentToReset(null);
    } catch (error) {
      console.error('Error resetting student points:', error);
    }
  };

  const getFilterDescription = () => {
    const pointType = sortBy === 'positive' ? 'positive points' : 'alerts';
    const period = dateFilter === 'total' ? 'all time' : 
                   dateFilter === 'today' ? 'today' : 
                   dateFilter === 'weekly' ? 'this week' : 'custom period';
    return `Sorted by ${pointType} (${period}) • Highest First`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Loading class data...</p>
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
                {classData?.name}
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm">
                {students.length} students 
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => onNavigateToTracking(classId)}
            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center glow hover:from-green-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-2xl border-2 border-green-400/30"
          >
            <Target className="w-5 h-5 mr-2" />
            <span>Track Participation</span>
          </button>

          <button
            onClick={onNavigateToParticipationFlags}
            className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center glow hover:from-orange-600 hover:to-yellow-600 transition-all transform hover:scale-105 shadow-2xl border-2 border-orange-400/30"
          >
            <HelpCircle className="w-5 h-5 mr-2" />
            <span>Learn About Flags</span>
          </button>

          <button
            onClick={() => setShowAddStudent(true)}
            className="btn-secondary px-6 py-3 rounded-lg font-medium text-sm flex items-center space-x-2 border border-gray-200"
          >
            <span>Add Student</span>
          </button>
        </div>

        {/* Sorting and Filtering Controls */}
        <div className="bg-white rounded-2xl p-6 mb-8 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Sort Students
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sort by Points Type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Sort by</label>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'positive' | 'negative')}
                  className="appearance-none w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm text-gray-900 pr-8"
                >
                  <option value="positive" className="bg-gray-800">Positive Points (Highest First)</option>
                  <option value="negative" className="bg-gray-800">Participation Flags (Most First)</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Time Period</label>
              <div className="relative">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as 'total' | 'today' | 'weekly' | 'custom')}
                  className="appearance-none w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm text-gray-900 pr-8"
                >
                  <option value="total" className="bg-gray-800">All Time</option>
                  <option value="today" className="bg-gray-800">Today</option>
                  <option value="weekly" className="bg-gray-800">Last 7 Days</option>
                  <option value="custom" className="bg-gray-800">Custom Range</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Custom Date Range - only show when custom is selected */}
            {dateFilter === 'custom' && (
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-2">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm text-gray-900"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm text-gray-900"
                    placeholder="End Date"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Students are sorted by {sortBy === 'positive' ? 'positive points' : 'alerts'} from highest to lowest for the selected time period.
            </p>
          </div> */}
        </div>

        {/* Students Grid */}
        {students.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 glow float">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No students yet</h2>
            <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">Add your first student to start tracking participation</p>
            <button
              onClick={() => setShowAddStudent(true)}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold text-sm transition-all"
            >
              Add Your First Student
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {getSortedStudents().map((student, index) => {
              const points = getStudentPointsForPeriod(student.id);
              return (
              <div
                key={student.id}
                className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm card-hover relative aspect-square flex flex-col items-center pt-6 pb-4"
              >
                {/* Dropdown Menu */}
                <div className="absolute top-2 right-2 z-10 dropdown-menu">
                  <button
                    onClick={() => setShowDropdown(showDropdown === student.id ? null : student.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {showDropdown === student.id && (
                    <div className="absolute right-0 mt-1 w-40 bg-white backdrop-blur-sm rounded-xl border border-gray-200 z-10 shadow-xl">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setEditingStudent(student);
                            setShowDropdown(null);
                          }}
                          className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2 transition-all text-xs"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit Student</span>
                        </button>
                        <button
                          onClick={() => {
                            setStudentToReset(student);
                            setShowDropdown(null);
                          }}
                          className="w-full px-3 py-2 text-left text-orange-600 hover:bg-orange-50 flex items-center space-x-2 transition-all text-xs"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Points</span>
                        </button>
                        <button
                          onClick={() => {
                            setStudentToDelete(student);
                            setShowDropdown(null);
                          }}
                          className="w-full px-3 py-2 text-left text-red-600 hover:bg-orange-50 flex items-center space-x-2 transition-all text-xs"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete Student</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
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
                <h3 className="text-sm text-gray-600 mt-2">
                  {student.name.split(' ')[0]}
                </h3>

                {/* Points Display */}
                <div className="flex justify-center items-center space-x-2 mt-2">
                  <span className="bg-green-100 text-green-700 px-1 py-0.5 rounded-md border border-green-200 text-xs font-semibold">
                    {points.positive}
                  </span>
                  <span className="bg-orange-100 text-orange-700 px-1 py-0.5 rounded-md border border-orange-200 text-xs font-semibold">
                    {points.negative}
                  </span>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddStudent && (
        <AddStudentModal
          classId={classId}
          onClose={() => setShowAddStudent(false)}
          onStudentAdded={handleStudentAdded}
        />
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onStudentUpdated={handleStudentUpdated}
        />
      )}

      {/* Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Delete Student</h2>
              </div>
              <button
                onClick={() => setStudentToDelete(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 text-center">
                Are you sure you want to delete <span className="font-bold text-red-600">{studentToDelete.name}</span>?
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setStudentToDelete(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteStudent(studentToDelete.id)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 px-4 rounded-lg font-semibold transition-all text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Points Confirmation Modal */}
      {studentToReset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Reset Points</h2>
              </div>
              <button
                onClick={() => setStudentToReset(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 text-center">
                Are you sure you want to reset all points for <span className="font-bold text-orange-600">{studentToReset.name}</span>?
              </p>
              <p className="text-gray-500 text-sm text-center mt-2">
                This will set both positive and negative points to zero.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setStudentToReset(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResetStudentPoints(studentToReset.id, studentToReset.name)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 px-4 rounded-lg font-semibold transition-all text-sm"
              >
                Reset Points
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassPage;