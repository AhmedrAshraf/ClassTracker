import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Users, Check, X, Clock, UserCheck, UserX, AlertCircle } from 'lucide-react';
import { supabase, Class, Student } from '../lib/supabase';

interface AttendancePageProps {
  onNavigateBack: () => void;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  created_at: string;
}

const AttendancePage: React.FC<AttendancePageProps> = ({ onNavigateBack }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudents();
      fetchAttendance();
    }
  }, [selectedClassId, selectedDate]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name');

      if (error) throw error;
      setClasses(data || []);
      if (data && data.length > 0) {
        setSelectedClassId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!selectedClassId) return;

    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', selectedClassId)
        .order('name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAttendance = async () => {
    // This would fetch from an attendance table (to be created)
    // For now, we'll simulate with empty data
    setAttendance({});
  };

  const updateAttendance = async (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setSaving(true);
    try {
      // This would save to an attendance table
      setAttendance(prev => ({
        ...prev,
        [studentId]: {
          id: `${studentId}-${selectedDate}`,
          student_id: studentId,
          date: selectedDate,
          status,
          created_at: new Date().toISOString()
        }
      }));
    } catch (error) {
      console.error('Error updating attendance:', error);
    } finally {
      setSaving(false);
    }
  };

  const getAttendanceStats = () => {
    const records = Object.values(attendance);
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const excused = records.filter(r => r.status === 'excused').length;
    const total = students.length;
    
    return { present, absent, late, excused, total };
  };

  const stats = getAttendanceStats();

  if (loading) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-300 text-sm">Loading attendance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen animated-bg relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-48 h-48 bg-gradient-to-br from-gray-600/10 to-gray-500/10 rounded-full blur-3xl float"></div>
        <div className="absolute bottom-20 left-20 w-48 h-48 bg-gradient-to-br from-gray-500/10 to-gray-600/10 rounded-full blur-3xl float" style={{ animationDelay: '3s' }}></div>
      </div>

      <div className="container mx-auto px-4 py-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={onNavigateBack}
             className="p-3 glass rounded-xl hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1 flex items-center">
                <Calendar className="w-8 h-8 mr-3 text-blue-400" />
                Attendance Tracking
              </h1>
              <p className="text-gray-300 text-sm">
                Track daily attendance for your students
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="glass rounded-2xl p-6 mb-8 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2">Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 input-glass rounded-lg focus:outline-none transition-all text-sm"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id} className="bg-gray-800">
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 input-glass rounded-lg focus:outline-none transition-all text-sm"
              />
            </div>
          </div>
        </div>

        {/* Attendance Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Present</p>
                <p className="text-2xl font-bold text-green-400">{stats.present}</p>
              </div>
              <UserCheck className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Absent</p>
                <p className="text-2xl font-bold text-red-400">{stats.absent}</p>
              </div>
              <UserX className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Late</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.late}</p>
              </div>
              <Clock className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Excused</p>
                <p className="text-2xl font-bold text-blue-400">{stats.excused}</p>
              </div>
              <AlertCircle className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Student Attendance List */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Student Attendance - {new Date(selectedDate).toLocaleDateString()}
          </h2>
          
          {students.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">No students in this class</p>
            </div>
          ) : (
            <div className="space-y-3">
              {students.map((student) => {
                const record = attendance[student.id];
                const status = record?.status || 'present';
                
                return (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {student.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{student.name}</h3>
                        <p className="text-xs text-gray-400">
                          Current status: <span className={`font-medium ${
                            status === 'present' ? 'text-green-400' :
                            status === 'absent' ? 'text-red-400' :
                            status === 'late' ? 'text-yellow-400' :
                            'text-blue-400'
                          }`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => updateAttendance(student.id, 'present')}
                        className={`p-2 rounded-lg transition-all ${
                          status === 'present' 
                            ? 'bg-green-500/30 text-green-400 border border-green-500/50' 
                            : 'bg-white/10 text-gray-400 hover:bg-green-500/20 hover:text-green-400'
                        }`}
                        disabled={saving}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateAttendance(student.id, 'late')}
                        className={`p-2 rounded-lg transition-all ${
                          status === 'late' 
                            ? 'bg-yellow-500/30 text-yellow-400 border border-yellow-500/50' 
                            : 'bg-white/10 text-gray-400 hover:bg-yellow-500/20 hover:text-yellow-400'
                        }`}
                        disabled={saving}
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateAttendance(student.id, 'excused')}
                        className={`p-2 rounded-lg transition-all ${
                          status === 'excused' 
                            ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50' 
                            : 'bg-white/10 text-gray-400 hover:bg-blue-500/20 hover:text-blue-400'
                        }`}
                        disabled={saving}
                      >
                        <AlertCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateAttendance(student.id, 'absent')}
                        className={`p-2 rounded-lg transition-all ${
                          status === 'absent' 
                            ? 'bg-red-500/30 text-red-400 border border-red-500/50' 
                            : 'bg-white/10 text-gray-400 hover:bg-red-500/20 hover:text-red-400'
                        }`}
                        disabled={saving}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;