import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, FileText, Users, TrendingUp, AlertTriangle, CheckCircle, Brain, MessageSquare, Eye, Calendar, BarChart3, Target, Award, Clock, Filter, ChevronDown, X } from 'lucide-react';
import { supabase, Class, Student, ParticipationLog, ParticipationCategory } from '../lib/supabase';
import TeacherNotesModal from './TeacherNotesModal';

interface AIAssistantPageProps {
  onNavigateBack: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface StudentData {
  id: string;
  name: string;
  positive_points: number;
  negative_points: number;
  logs: ParticipationLog[];
  notes: string[];
}

interface ClassAnalysis {
  totalStudents: number;
  averagePositivePoints: number;
  averageNegativePoints: number;
  topPerformers: StudentData[];
  needsAttention: StudentData[];
  mostCommonConcerns: { category: string; count: number }[];
}

const AIAssistantPage: React.FC<AIAssistantPageProps> = ({ onNavigateBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [classData, setClassData] = useState<StudentData[]>([]);
  const [categories, setCategories] = useState<ParticipationCategory[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchClasses();
    fetchCategories();
    addWelcomeMessage();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchClassData();
    }
  }, [selectedClassId, selectedPeriod]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('participation_categories')
        .select('*');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchClassData = async () => {
    if (!selectedClassId) return;

    try {
      // Fetch students
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', selectedClassId);

      if (studentsError) throw studentsError;

      // Fetch participation logs with date filtering
      const dateFilter = getDateFilter();
      let logsQuery = supabase
        .from('participation_logs')
        .select('*')
        .in('student_id', students?.map(s => s.id) || []);

      if (dateFilter) {
        logsQuery = logsQuery.gte('created_at', dateFilter);
      }

      const { data: logs, error: logsError } = await logsQuery;
      if (logsError) throw logsError;

      // Process data
      const processedData: StudentData[] = (students || []).map(student => {
        const studentLogs = (logs || []).filter(log => log.student_id === student.id);
        const positivePoints = studentLogs.filter(log => log.is_positive).reduce((sum, log) => sum + log.points, 0);
        const negativePoints = studentLogs.filter(log => !log.is_positive).reduce((sum, log) => sum + log.points, 0);
        const notes = studentLogs.filter(log => log.notes).map(log => log.notes!);

        return {
          id: student.id,
          name: student.name,
          positive_points: positivePoints,
          negative_points: negativePoints,
          logs: studentLogs,
          notes
        };
      });

      setClassData(processedData);
    } catch (error) {
      console.error('Error fetching class data:', error);
    }
  };

  const getDateFilter = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return today.toISOString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return weekAgo.toISOString();
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return monthAgo.toISOString();
      default:
        return null;
    }
  };

  const addWelcomeMessage = () => {
    const welcomeMessage: Message = {
      id: 'welcome',
      type: 'assistant',
      content: `🧠 Welcome to your AI Report Assistant! I can help you analyze participation data and generate insights about your students.

I can help you with:
• **Class Overview** - Get a comprehensive analysis of your class performance
• **Individual Student Reports** - Detailed insights about specific students
• **Top Performers** - Identify students who are excelling
• **Students Needing Attention** - Find students who may need extra support
• **Intervention Strategies** - Get specific recommendations for behavioral concerns
• **Progress Comparisons** - Compare student performance over time

Select a class and time period above, then ask me what you'd like to know!`,
      timestamp: new Date(),
      suggestions: [
        "Give me a class overview",
        "Show me top performing students",
        "Which students need attention?",
        "Generate individual student reports",
        "What intervention strategies do you recommend?"
      ]
    };
    setMessages([welcomeMessage]);
  };

  // Helper functions for varied language generation
  const getRandomElement = (array: string[]) => {
    return array[Math.floor(Math.random() * array.length)];
  };

  const getPerformanceDescription = (positivePoints: number, alertCount: number) => {
    // Explicitly handle the case of zero positive points and zero alerts
    if (positivePoints === 0 && alertCount === 0) {
      const quietPresence = [
        "a quiet classroom presence with no recorded participation or behavioral concerns",
        "minimal recorded classroom engagement with no behavioral alerts",
        "limited documented participation while maintaining appropriate behavior",
        "low participation visibility with no behavioral disruptions noted",
        "quiet conduct with no recorded positive participation or alerts"
      ];
      return getRandomElement(quietPresence);
    }

    // Calculate severity based on both positive points and alert count
    let severity: 'mild' | 'moderate' | 'high' = 'mild';

    if (positivePoints === 0) {
      severity = alertCount === 0 ? 'mild' : alertCount <= 2 ? 'moderate' : 'high';
    } else {
      if (alertCount === 0) {
        severity = 'mild';
      } else if (alertCount <= 2) {
        severity = 'moderate';
      } else {
        severity = 'high';
      }
    }

    // Define phrase arrays for different scenarios
    const quietPresence = [
      "a quiet classroom presence with no recorded participation or behavioral concerns",
      "minimal recorded classroom engagement with no behavioral alerts",
      "limited documented participation while maintaining appropriate behavior",
      "low participation visibility with no behavioral disruptions noted",
      "quiet conduct with no recorded positive participation or alerts"
    ];

    const lowEngagementWithConcerns = [
      "limited positive participation combined with some behavioral concerns",
      "minimal recorded engagement alongside behavioral challenges",
      "low participation visibility with emerging behavioral patterns",
      "quiet participation coupled with occasional behavioral alerts"
    ];

    const noEngagementHighConcerns = [
      "absence of positive participation combined with significant behavioral challenges",
      "no recorded positive engagement while exhibiting concerning behavioral patterns",
      "lack of documented participation alongside persistent behavioral difficulties"
    ];

    const excellent = [
      "exceptional classroom citizenship",
      "consistently outstanding engagement",
      "exemplary participation and conduct",
      "remarkable dedication to learning",
      "superior classroom leadership",
      "outstanding academic engagement"
    ];

    const good = [
      "generally strong engagement with minor areas for growth",
      "solid participation with occasional behavioral considerations",
      "positive classroom presence with room for improvement",
      "commendable engagement with isolated concerns",
      "strong foundation with minor adjustments needed",
      "positive trajectory with minimal intervention required"
    ];

    const concerning = [
      "requiring targeted support and intervention",
      "exhibiting patterns that warrant focused attention",
      "demonstrating potential with consistent behavioral challenges",
      "showing promise while needing structured guidance",
      "displaying mixed engagement requiring strategic support"
    ];

    // Map severity to appropriate phrases based on positive points
    if (positivePoints === 0) {
      if (severity === 'mild') {
        return getRandomElement(quietPresence);
      } else if (severity === 'moderate') {
        return getRandomElement(lowEngagementWithConcerns);
      } else {
        return getRandomElement(noEngagementHighConcerns);
      }
    } else {
      if (severity === 'mild') {
        return getRandomElement(excellent);
      } else if (severity === 'moderate') {
        return getRandomElement(good);
      } else {
        return getRandomElement(concerning);
      }
    }
  };

  const getConcernDescription = (concernArea: string, count: number) => {
    const descriptions = [
      `The primary area of concern appears to be ${concernArea.toLowerCase()}`,
      `A recurring behavioral pattern observed is ${concernArea.toLowerCase()}`,
      `Key challenges include instances of ${concernArea.toLowerCase()}`,
      `The most frequent concern involves ${concernArea.toLowerCase()}`,
      `Repeated observations indicate issues with ${concernArea.toLowerCase()}`
    ];
    return getRandomElement(descriptions) + `, occurring ${count} time${count !== 1 ? 's' : ''}.`;
  };

  const getRecommendations = (alertCount: number, positivePoints: number) => {
    if (alertCount === 0 || (alertCount === 1 && positivePoints > 15)) {
      const minor = [
        "Continue reinforcing positive behaviors through verbal praise and recognition.",
        "Consider a brief, supportive check-in to maintain current positive trajectory.",
        "Implement preventive strategies to sustain excellent performance.",
        "Provide leadership opportunities to further engage this student.",
        "Monitor for continued patterns while celebrating current success."
      ];
      return getRandomElement(minor);
    } else if (alertCount <= 2) {
      const moderate = [
        "Implement targeted interventions such as a daily check-in system within 24-48 hours.",
        "Collaborate with the student to set clear, achievable behavioral goals this week.",
        "Initiate parent communication to discuss support strategies and home-school alignment.",
        "Develop a simple behavior tracking system with immediate feedback mechanisms.",
        "Schedule a private conversation to understand underlying triggers and motivations."
      ];
      return getRandomElement(moderate);
    } else {
      const intensive = [
        "Develop a comprehensive behavior support plan within 48 hours involving administration.",
        "Seek additional guidance from school support staff and consider a formal intervention team.",
        "Schedule an urgent parent conference to establish a coordinated home-school partnership.",
        "Implement immediate daily monitoring with structured consequences and rewards.",
        "Consider referral to school counseling services for additional behavioral assessment."
      ];
      return getRandomElement(intensive);
    }
  };

  const getConcludingRemark = (name: string, alertCount: number, positivePoints: number) => {
    // Handle cases where student has 0 positive points
    if (positivePoints === 0) {
      if (alertCount === 0) {
        const encourageParticipation = [
          `Encouraging ${name} to participate more actively could help showcase their potential.`,
          `${name} would benefit from strategies to increase classroom participation and engagement.`,
          `Supporting ${name} in finding opportunities to contribute positively will enhance their learning experience.`,
          `${name} has the potential to contribute more actively with appropriate encouragement and support.`
        ];
        return getRandomElement(encourageParticipation);
      } else if (alertCount <= 2) {
        const addressBothIssues = [
          `${name} needs support to increase positive participation while addressing behavioral concerns.`,
          `Focusing on both engagement strategies and behavioral support will help ${name} succeed.`,
          `${name} would benefit from interventions targeting both participation and behavioral improvement.`
        ];
        return getRandomElement(addressBothIssues);
      } else {
        const urgentIntervention = [
          `${name} requires immediate intervention to address behavioral concerns and encourage positive engagement.`,
          `Comprehensive support is essential for ${name} to develop both appropriate behavior and active participation.`,
          `${name} needs intensive guidance to establish positive classroom behaviors and meaningful engagement.`
        ];
        return getRandomElement(urgentIntervention);
      }
    }
    
    // Original logic for students with positive points
    if (alertCount === 0 && positivePoints > 20) {
      const excellent = [
        `${name} continues to be an exemplary member of the classroom community.`,
        `${name} serves as a positive role model for peers and demonstrates consistent excellence.`,
        `${name}'s dedication to learning and positive behavior sets a high standard for others.`
      ];
      return getRandomElement(excellent);
    } else if (alertCount <= 1) {
      const good = [
        `${name} remains a valuable contributor to the classroom environment.`,
        `With continued support, ${name} will maintain their positive academic trajectory.`,
        `${name}'s progress demonstrates their commitment to personal growth and learning.`
      ];
      return getRandomElement(good);
    } else {
      const needsSupport = [
        `Addressing these patterns will help ${name} thrive academically and socially.`,
        `With consistent intervention, ${name} has the potential to significantly improve.`,
        `${name} will benefit from structured support to reach their full potential.`
      ];
      return getRandomElement(needsSupport);
    }
  };

  const getAssistantResponse = (userInput: string): Message => {
    const input = userInput.toLowerCase().trim();
    
    if (!selectedClassId || classData.length === 0) {
      return {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'Please select a class first to analyze participation data.',
        timestamp: new Date(),
        suggestions: ['Select a class from the dropdown above']
      };
    }

    let response = '';
    let suggestions: string[] = [];

    if (input.includes('class overview') || input.includes('class analysis') || input.includes('overview')) {
      const totalStudents = classData.length;
      const avgPositive = Math.round(classData.reduce((sum, s) => sum + s.positive_points, 0) / totalStudents);
      const avgNegative = Math.round(classData.reduce((sum, s) => sum + s.negative_points, 0) / totalStudents);
      const topPerformers = classData.filter(s => s.positive_points > avgPositive && s.negative_points <= 2).length;
      const needsAttention = classData.filter(s => s.negative_points > 3 || s.positive_points < avgPositive / 2).length;

      response = `## 📊 Comprehensive Class Analysis

**Class Performance Metrics:**
• Total Students: ${totalStudents}
• Average Positive Points: ${avgPositive}
• Average Behavioral Alerts: ${avgNegative}
• High Performers: ${topPerformers} students (${Math.round((topPerformers/totalStudents)*100)}%)
• Students Needing Support: ${needsAttention} students (${Math.round((needsAttention/totalStudents)*100)}%)

**Strategic Insights:**
${avgPositive > 15 ? 'Your class demonstrates strong overall engagement with excellent participation levels.' : 'There are opportunities to increase overall class engagement through targeted strategies.'}

${avgNegative < 2 ? 'Behavioral management is highly effective with minimal disruptions.' : 'Consider implementing class-wide behavioral interventions to address recurring concerns.'}

**Recommended Actions:**
• ${topPerformers > totalStudents/2 ? 'Leverage high-performing students as peer mentors' : 'Focus on building positive momentum through recognition programs'}
• ${needsAttention > totalStudents/3 ? 'Implement tiered intervention strategies for struggling students' : 'Maintain current support systems while monitoring at-risk students'}
• Schedule weekly data reviews to track progress and adjust strategies accordingly`;

      suggestions = [
        "Show me top performing students",
        "Which students need attention?",
        "Generate individual student reports"
      ];
    }
    
    else if (input.includes('top') || input.includes('best') || input.includes('performing') || input.includes('excellent')) {
      const topStudents = classData
        .filter(s => s.positive_points > 0)
        .sort((a, b) => b.positive_points - a.positive_points)
        .slice(0, 5);

      if (topStudents.length === 0) {
        response = 'No students have earned positive points in the selected time period.';
      } else {
        response = `## 🌟 Top Performing Students\n\n`;
        topStudents.forEach((student, index) => {
          const rank = index + 1;
          const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '⭐';
          response += `${emoji} **${student.name}**\n`;
          response += `• Positive Points: ${student.positive_points}\n`;
          response += `• Behavioral Alerts: ${student.negative_points}\n`;
          if (student.negative_points === 0) {
            response += `• Status: Exemplary conduct with zero behavioral concerns\n`;
          } else if (student.negative_points <= 2) {
            response += `• Status: Excellent performance with minimal concerns\n`;
          }
          response += `• Recommendation: ${student.negative_points === 0 ? 'Consider for peer leadership opportunities' : 'Continue positive reinforcement strategies'}\n\n`;
        });
      }

      suggestions = [
        "Which students need attention?",
        "Generate individual student reports",
        "What intervention strategies do you recommend?"
      ];
    }
    
    else if (input.includes('attention') || input.includes('concern') || input.includes('struggling') || input.includes('help')) {
      const concernStudents = classData
        .filter(s => s.negative_points > 2 || (s.positive_points < 5 && s.negative_points > 0))
        .sort((a, b) => b.negative_points - a.negative_points);

      if (concernStudents.length === 0) {
        response = '🎉 Excellent news! No students currently require immediate attention. All students are performing within acceptable behavioral parameters.';
      } else {
        response = `## ⚠️ Students Requiring Attention\n\n`;
        concernStudents.forEach(student => {
          const urgency = student.negative_points > 5 ? 'HIGH PRIORITY' : student.negative_points > 3 ? 'MODERATE' : 'LOW';
          const urgencyEmoji = urgency === 'HIGH PRIORITY' ? '🚨' : urgency === 'MODERATE' ? '⚠️' : '📋';
          
          response += `${urgencyEmoji} **${student.name}** (${urgency})\n`;
          response += `• Positive Points: ${student.positive_points}\n`;
          response += `• Behavioral Alerts: ${student.negative_points}\n`;
          response += `• Immediate Action: ${urgency === 'HIGH PRIORITY' ? 'Schedule parent conference within 24 hours' : urgency === 'MODERATE' ? 'Implement daily check-ins this week' : 'Monitor closely and provide additional support'}\n\n`;
        });
      }

      suggestions = [
        "Generate individual student reports",
        "What intervention strategies do you recommend?",
        "Show me top performing students"
      ];
    }
    
    else if (input.includes('report') || input.includes('individual') || input.includes('student report')) {
      response = `## 📋 Individual Student Reports\n\n`;
      
      classData.forEach(student => {
        // Calculate logs and totals from actual participation data
        const positiveLogs = student.logs.filter(log => log.is_positive);
        const negativeLogs = student.logs.filter(log => {
          if (log.is_positive) return false;
          // Find category name to exclude Teacher Notes
          const category = categories.find(c => c.id === log.category_id);
          return category?.name !== 'Teacher Note';
        });
        const totalPositive = positiveLogs.length;
        
        // Count only true "alerts," not Teacher Note entries
        const alertCount = student.logs
          .filter(log => !log.is_positive)
          .filter(log => {
            const cat = categories.find(c => c.id === log.category_id);
            return cat?.name !== 'Teacher Note';
          })
          .length;
        const totalNegative = alertCount;
        const firstName = student.name.split(' ')[0];

        // Early exit for students with zero positive participation
        if (totalPositive === 0) {
          if (totalNegative === 0) {
            response += `### ${student.name}\n\n`;
            response += `${firstName} maintained a quiet presence during this period, with no participation events or behavioral alerts recorded.\n\n---\n\n`;
            return;
          } else {
            const alertCounts: Record<string, number> = {};
            for (const log of negativeLogs) {
              const category = categories.find(c => c.id === log.category_id);
              const categoryName = category?.name || 'Unknown';
              if (!alertCounts[categoryName]) alertCounts[categoryName] = 0;
              alertCounts[categoryName]++;
            }
            const mostCommonAlert = Object.entries(alertCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
            const mostCommonAlertCount = alertCounts[mostCommonAlert] || 0;

            response += `### ${student.name}\n\n`;
            response += `${firstName} did not record any participation events during this period, and ${totalNegative} behavioral alert${totalNegative > 1 ? 's were' : ' was'} recorded${mostCommonAlert ? ` (primarily "${mostCommonAlert}" occurred ${mostCommonAlertCount} time${mostCommonAlertCount > 1 ? 's' : ''})` : ''}.`;
            response += `\n\n---\n\n`;
            return;
          }
        }

        const mostFrequentConcern = student.logs
          .filter(log => !log.is_positive)
          .reduce((acc, log) => {
            const category = categories.find(c => c.id === log.category_id);
            if (category) {
              acc[category.name] = (acc[category.name] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>);

        const topConcern = Object.entries(mostFrequentConcern).sort(([,a], [,b]) => b - a)[0];
        const mostFrequentConcernCount = topConcern ? topConcern[1] : 0;
        const concernArea = topConcern ? topConcern[0] : '';

        // Generate dynamic summary using performance description
        const performanceDesc = getPerformanceDescription(student.positive_points, alertCount);
        const recommendation = getRecommendations(alertCount, student.positive_points);
        const conclusion = getConcludingRemark(student.name, alertCount, student.positive_points);

        response += `### ${student.name}\n\n`;
        response += `${student.name} ${performanceDesc} during the ${selectedPeriod === 'all' ? 'all time' : selectedPeriod} period, earning ${student.positive_points} positive participation points and receiving ${alertCount} behavioral alert${alertCount !== 1 ? 's' : ''}. `;
        
        if (topConcern && mostFrequentConcernCount > 0) {
          response += `${getConcernDescription(concernArea, mostFrequentConcernCount)} `;
        }

        // Add teacher notes if available
        if (student.notes.length > 0) {
          response += `Teacher observations: "${student.notes[student.notes.length - 1]}" `;
        }

        response += `${recommendation} ${conclusion}\n\n---\n\n`;
      });

      suggestions = [
        "What intervention strategies do you recommend?",
        "Show me top performing students",
        "Which students need attention?"
      ];
    }
    
    else if (input.includes('intervention') || input.includes('strategies') || input.includes('recommend')) {
      const highConcernStudents = classData.filter(s => s.negative_points > 3);
      const moderateConcernStudents = classData.filter(s => s.negative_points > 1 && s.negative_points <= 3);

      response = `## 🎯 Intervention Strategies & Recommendations\n\n`;

      if (highConcernStudents.length > 0) {
        response += `### 🚨 Immediate Intervention Required (${highConcernStudents.length} students)\n`;
        highConcernStudents.forEach(student => {
          response += `**${student.name}:**\n`;
          response += `• **Timeline:** Implement within 24-48 hours\n`;
          response += `• **Strategy:** Comprehensive behavior support plan with daily monitoring\n`;
          response += `• **Parent Contact:** Schedule conference immediately\n`;
          response += `• **Support Team:** Involve administration and school counselor\n`;
          response += `• **Documentation:** Daily behavior tracking with specific goals\n\n`;
        });
      }

      if (moderateConcernStudents.length > 0) {
        response += `### ⚠️ Targeted Support Needed (${moderateConcernStudents.length} students)\n`;
        moderateConcernStudents.forEach(student => {
          response += `**${student.name}:**\n`;
          response += `• **Timeline:** Begin intervention within 1 week\n`;
          response += `• **Strategy:** Daily check-ins with clear behavioral expectations\n`;
          response += `• **Parent Contact:** Informational call to discuss support strategies\n`;
          response += `• **Monitoring:** Weekly progress reviews with adjustments as needed\n`;
          response += `• **Positive Reinforcement:** Implement immediate recognition system\n\n`;
        });
      }

      if (highConcernStudents.length === 0 && moderateConcernStudents.length === 0) {
        response += `🎉 **Excellent Class Management!**\n\nYour current strategies are highly effective. Consider these maintenance approaches:\n\n`;
        response += `• Continue current positive reinforcement systems\n`;
        response += `• Implement peer mentoring programs using top performers\n`;
        response += `• Schedule monthly check-ins to maintain positive momentum\n`;
        response += `• Develop leadership opportunities for high-achieving students\n`;
      }

      suggestions = [
        "Generate individual student reports",
        "Show me top performing students",
        "Give me a class overview"
      ];
    }
    
    else {
      response = `I can help you analyze your class participation data! Here's what I can do:

📊 **Class Overview** - Get comprehensive class performance metrics
👥 **Individual Reports** - Detailed analysis for each student  
🌟 **Top Performers** - Identify your highest-achieving students
⚠️ **Students Needing Attention** - Find students who need support
🎯 **Intervention Strategies** - Get specific behavioral recommendations

What would you like to explore?`;

      suggestions = [
        "Give me a class overview",
        "Show me top performing students", 
        "Which students need attention?",
        "Generate individual student reports"
      ];
    }

    return {
      id: Date.now().toString(),
      type: 'assistant',
      content: response,
      timestamp: new Date(),
      suggestions
    };
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const assistantMessage = getAssistantResponse(inputValue);
    setMessages(prev => [...prev, assistantMessage]);
    setLoading(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const exportToCSV = () => {
    if (!classData || !categories || !classes || !selectedClassId) return;

    // 1. Resolve class name
    const className = classes.find(c => c.id === selectedClassId)?.name || "Unknown Class";

    // 2. Human-readable Time Period label
    const getTimePeriodLabel = () => {
      if (selectedPeriod === "custom" && customStartDate && customEndDate) {
        const start = new Date(customStartDate).toLocaleDateString();
        const end = new Date(customEndDate).toLocaleDateString();
        return `${start} to ${end}`;
      }
      const map: Record<string, string> = {
        today: "Today",
        week: "This Week",
        month: "This Month",
        all: "All Time"
      };
      return map[selectedPeriod] || selectedPeriod;
    };
    const timePeriod = getTimePeriodLabel();

    // 3. CSV headers
    const headers = [
      "Class",
      "Time Period",
      "Student (First Name)",
      "Points (Positive Only)",
      "Total Positive Points",
      "No Feedback-Seeking / Use",
      "Passive Participation",
      "Off-Task / Distracted",
      "Inauthentic Work",
      "Not Following Directions",
      "Needs Support to Engage",
      "Unprepared for Class",
      "Low Effort / Incomplete Work"
    ];

    const flagNames = headers.slice(5); // last 8 columns

    // 4. Construct data rows
    const rows = classData.map(student => {
      const firstName = student.name.split(" ")[0];
      const positivePoints = student.positive_points;

      // Initialize all flags to 0
      const flagMap: Record<string, number> = {};
      flagNames.forEach(name => {
        flagMap[name] = 0;
      });

      // Loop through logs to check which flags were triggered
      student.logs.forEach(log => {
        if (!log.is_positive) {
          const categoryName = categories.find(c => c.id === log.category_id)?.name;
          if (categoryName && flagMap.hasOwnProperty(categoryName)) {
            flagMap[categoryName] = 1;
          }
        }
      });

      return [
        className,
        timePeriod,
        firstName,
        positivePoints,
        positivePoints,
        ...flagNames.map(name => flagMap[name])
      ];
    });

    // 5. Convert to CSV format
    const csvContent = [
      headers.join(","),
      ...rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
    ].join("\n");

    // 6. Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `class-participation-report-${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      <div className="container mx-auto px-4 py-6 relative z-10 max-w-6xl">
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
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 flex items-center">
                <Brain className="w-8 h-8 mr-3 text-purple-500" />
                AI Report Assistant
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm">
                Generate intelligent insights and reports from your participation data
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl p-6 mb-8 border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Class</label>
              <div className="relative">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="appearance-none w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm text-gray-900 pr-8"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id} className="bg-gray-800">
                      {cls.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Time Period</label>
              <div className="relative">
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as 'today' | 'week' | 'month' | 'all')}
                  className="appearance-none w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm text-gray-900 pr-8"
                >
                  <option value="today" className="bg-gray-800">Today</option>
                  <option value="week" className="bg-gray-800">This Week</option>
                  <option value="month" className="bg-gray-800">This Month</option>
                  <option value="all" className="bg-gray-800">All Time</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-end space-x-2">
              <button
                onClick={exportToCSV}
                disabled={classData.length === 0}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => setShowNotesModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center justify-center space-x-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Notes</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm h-[600px] flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 ${
                    message.type === 'user'
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.type === 'user' 
                        ? 'bg-white/20' 
                        : 'bg-purple-500'
                    }`}>
                      {message.type === 'user' ? (
                        <Users className="w-4 h-4" />
                      ) : (
                        <Brain className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm whitespace-pre-line ${message.type === 'user' ? 'text-white' : 'text-gray-900'}`}>
                        {message.content}
                      </div>
                      
                      {/* Suggestions */}
                      {message.suggestions && message.suggestions.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs text-gray-500 mb-2">Try asking:</p>
                          {message.suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="block w-full text-left text-xs px-3 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-all border border-gray-200"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <p className={`text-xs mt-2 ${message.type === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 max-w-[85%]">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <Brain className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex space-x-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask me about your class data..."
                className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={handleSendMessage}
                disabled={loading || !inputValue.trim()}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
              >
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Analyze</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Notes Modal */}
      {showNotesModal && (
        <TeacherNotesModal
          classId={selectedClassId}
          onClose={() => setShowNotesModal(false)}
        />
      )}
    </div>
  );
};

export default AIAssistantPage;