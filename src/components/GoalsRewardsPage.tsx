import React, { useState, useEffect } from 'react';
import { ArrowLeft, Target, Award, Plus, Edit, Trash2, CheckCircle, Star, Gift, TrendingUp } from 'lucide-react';
import { supabase, Class, Student } from '../lib/supabase';

interface GoalsRewardsPageProps {
  onNavigateBack: () => void;
}

interface Goal {
  id: string;
  student_id: string;
  title: string;
  description: string;
  target_points: number;
  current_points: number;
  deadline: string;
  is_completed: boolean;
  reward: string;
  created_at: string;
}

interface ClassReward {
  id: string;
  class_id: string;
  title: string;
  description: string;
  points_required: number;
  is_active: boolean;
  created_at: string;
}

const GoalsRewardsPage: React.FC<GoalsRewardsPageProps> = ({ onNavigateBack }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [classRewards, setClassRewards] = useState<ClassReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudents();
      fetchGoals();
      fetchClassRewards();
    }
  }, [selectedClassId]);

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

  const fetchGoals = async () => {
    // This would fetch from a goals table (to be created)
    setGoals([]);
  };

  const fetchClassRewards = async () => {
    // This would fetch from a class_rewards table (to be created)
    setClassRewards([]);
  };

  const getStudentProgress = (student: Student) => {
    const studentGoals = goals.filter(g => g.student_id === student.id);
    const completedGoals = studentGoals.filter(g => g.is_completed).length;
    const totalGoals = studentGoals.length;
    
    return {
      totalGoals,
      completedGoals,
      progressPercentage: totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-300 text-sm">Loading goals and rewards...</p>
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
                <Target className="w-8 h-8 mr-3 text-emerald-400" />
                Goals & Rewards
              </h1>
              <p className="text-gray-300 text-sm">
                Set individual goals and class-wide rewards to motivate students
              </p>
            </div>
          </div>
        </div>

        {/* Class Selection */}
        <div className="glass rounded-2xl p-6 mb-8 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Select Class</h2>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowAddGoal(true)}
                className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Goal</span>
              </button>
              <button
                onClick={() => setShowAddReward(true)}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2 hover:from-yellow-600 hover:to-orange-600 transition-all"
              >
                <Gift className="w-4 h-4" />
                <span>Add Reward</span>
              </button>
            </div>
          </div>
          
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

        {selectedClassId && (
          <>
            {/* Class-Wide Rewards */}
            <div className="glass rounded-2xl p-6 mb-8 border border-white/10">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center">
                <Gift className="w-5 h-5 mr-2 text-yellow-400" />
                Class Rewards
              </h2>
              
              {classRewards.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400 mb-4">No class rewards set up yet</p>
                  <button
                    onClick={() => setShowAddReward(true)}
                    className="btn-primary px-4 py-2 rounded-lg text-sm"
                  >
                    Create First Reward
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classRewards.map((reward) => (
                    <div key={reward.id} className="bg-white/5 rounded-xl p-4 border border-yellow-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-yellow-400">{reward.title}</h3>
                        <Award className="w-5 h-5 text-yellow-400" />
                      </div>
                      <p className="text-gray-300 text-sm mb-3">{reward.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          {reward.points_required} points required
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          reward.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {reward.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Student Goals */}
            <div className="glass rounded-2xl p-6 border border-white/10">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center">
                <Target className="w-5 h-5 mr-2 text-emerald-400" />
                Individual Student Goals
              </h2>
              
              {students.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">No students in this class yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {students.map((student) => {
                    const progress = getStudentProgress(student);
                    return (
                      <div key={student.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              {student.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-bold text-white">{student.name}</h3>
                            <p className="text-xs text-gray-400">
                              {progress.completedGoals}/{progress.totalGoals} goals completed
                            </p>
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-400">Progress</span>
                            <span className="text-xs text-emerald-400 font-bold">
                              {Math.round(progress.progressPercentage)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all"
                              style={{ width: `${progress.progressPercentage}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Current Points */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-gray-300">Current Points</span>
                          <span className="text-lg font-bold text-emerald-400">
                            {student.total_positive_points}
                          </span>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex space-x-2">
                          <button className="flex-1 bg-emerald-500/20 text-emerald-400 py-2 px-3 rounded-lg text-xs hover:bg-emerald-500/30 transition-all">
                            Set Goal
                          </button>
                          <button className="flex-1 bg-blue-500/20 text-blue-400 py-2 px-3 rounded-lg text-xs hover:bg-blue-500/30 transition-all">
                            View Goals
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GoalsRewardsPage;