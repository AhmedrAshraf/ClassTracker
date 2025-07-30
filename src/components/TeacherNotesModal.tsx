import React, { useState, useEffect } from 'react';
import { X, MessageSquare, User, Calendar } from 'lucide-react';
import { supabase, Student, ParticipationLog } from '../lib/supabase';

interface TeacherNotesModalProps {
  classId?: string;
  onClose: () => void;
}

interface NoteWithStudent extends ParticipationLog {
  student_name: string;
}

const TeacherNotesModal: React.FC<TeacherNotesModalProps> = ({ classId, onClose }) => {
  const [notes, setNotes] = useState<NoteWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTeacherNotes();
  }, [classId]);

  const fetchTeacherNotes = async () => {
    try {
      setLoading(true);
      setError('');

      // First, get the "Teacher Note" category ID
      const { data: categories, error: categoryError } = await supabase
        .from('participation_categories')
        .select('id')
        .eq('name', 'Teacher Note')
        .limit(1);

      if (categoryError) throw categoryError;
      
      if (!categories || categories.length === 0) {
        setError('Teacher Note category not found. Please add it to your database first.');
        setLoading(false);
        return;
      }

      const teacherNoteCategoryId = categories[0].id;

      // Build the query to get notes with student information
      let query = supabase
        .from('participation_logs')
        .select(`
          *,
          students!inner(id, name, class_id)
        `)
        .eq('category_id', teacherNoteCategoryId)
        .not('notes', 'is', null)
        .neq('notes', '')
        .order('created_at', { ascending: false });

      // If classId is provided, filter by class
      if (classId) {
        query = query.eq('students.class_id', classId);
      }

      const { data: notesData, error: notesError } = await query;

      if (notesError) throw notesError;

      // Transform the data to include student name directly
      const notesWithStudents: NoteWithStudent[] = (notesData || []).map(note => ({
        ...note,
        student_name: (note as any).students.name
      }));

      setNotes(notesWithStudents);
    } catch (err: any) {
      console.error('Error fetching teacher notes:', err);
      setError(err.message || 'Failed to fetch teacher notes');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-200 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Teacher Notes</h2>
              <p className="text-gray-600 text-sm">
                {classId ? 'Notes for selected class' : 'All teacher notes'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-600 text-sm">Loading teacher notes...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <X className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-gray-900 font-medium mb-1">No teacher notes found</h3>
              <p className="text-gray-500 text-sm">
                {classId 
                  ? 'No notes have been added for students in this class yet.'
                  : 'No teacher notes have been added yet.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-blue-900 font-medium text-sm">
                          {note.student_name}
                        </h4>
                        <div className="flex items-center text-blue-600 text-xs">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(note.created_at)}
                        </div>
                      </div>
                      <p className="text-blue-800 text-sm leading-relaxed">
                        {note.notes}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-500 text-xs">
              {notes.length > 0 && `${notes.length} note${notes.length !== 1 ? 's' : ''} found`}
            </p>
            <button
              onClick={onClose}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-all text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherNotesModal;