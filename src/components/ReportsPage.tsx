// src/components/ReportsPage.tsx
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import html2pdf from 'html2pdf.js';
import {
  ArrowLeft,
  Download,
  BarChart3,
  PieChart,
  TrendingUp,
  AlertTriangle,
  Eye,
  EyeOff,
  Bot,
  Sparkles,
  FileText,
  MessageSquare,
} from 'lucide-react';
import {
  supabase,
  Class,
  Student,
  ParticipationLog,
  ParticipationCategory,
} from '../lib/supabase';

// Helper for picking a random template sentence
const pick = (arr: string[]): string =>
  arr[Math.floor(Math.random() * arr.length)];

interface ReportsPageProps {
  onNavigateBack: () => void;
}

interface ReportData {
  totalPositivePoints: number;
  totalNegativePoints: number;
  netPoints: number;
  studentCount: number;
  averagePositive: number;
  averageNegative: number;
  topPerformers: Student[];
  needsAttention: Student[];
  dailyData: { date: string; positive: number; negative: number }[];
  categoryBreakdown: {
    category: ParticipationCategory;
    count: number;
    students: { name: string; count: number }[];
  }[];
  teacherNotes: ParticipationLog[];
}

interface ClassWideReportData extends ReportData {
  allStudentsWithPoints: { student: Student; positivePoints: number; negativePoints: number }[];
}

const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigateBack }) => {
  // --- CORE DATA STATE ---
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [categories, setCategories] = useState<ParticipationCategory[]>([]);

  // --- FILTER STATE ---
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'daily' | 'weekly' | 'total' | 'custom'>('total');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // --- REPORT DATA & LOADING ---
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [classWideReportData, setClassWideReportData] = useState<ClassWideReportData | null>(null);
  const [loading, setLoading] = useState(false);

  // --- CATEGORY DETAILS TOGGLE ---
  const [showCategoryDetails, setShowCategoryDetails] = useState<Record<string, boolean>>({});

  // --- AI REPORT STATE ---
  const [aiReportStudent, setAiReportStudent] = useState<string>('');
  const [aiReportStartDate, setAiReportStartDate] = useState('');
  const [aiReportEndDate, setAiReportEndDate] = useState('');
  const [aiReportFormat, setAiReportFormat] = useState<'detailed' | 'summary'>('detailed');
  const [aiReportTone, setAiReportTone] = useState<'formal' | 'friendly' | 'parent'>('formal');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatedAIReportContent, setGeneratedAIReportContent] = useState<string>('');
  const [aiReport, setAiReport] = useState<string>('');
  const aiReportContentRef = React.useRef<HTMLDivElement>(null);

  // --- DIRECT GENERATE BUTTON LOADING ---
  const [loadingAIReport, setLoadingAIReport] = useState(false);

  // --- EFFECTS TO FETCH INITIAL DATA / RE-GENERATE ON FILTER CHANGE ---
  useEffect(() => {
    fetchClasses();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudents();
      generateReport();
    }
  }, [selectedClassId, selectedStudentId, dateFilter, customStartDate, customEndDate]);

  // --- DATA FETCHERS ---
  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      setClasses(data || []);
      if (data?.length) setSelectedClassId(data[0].id);
    } catch (e) {
      console.error(e);
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
    } catch (e) {
      console.error(e);
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
    } catch (e) {
      console.error(e);
    }
  };

  // --- HELPERS FOR DATE FILTERING ---
  const getDateFilter = () => {
    const now = new Date();
    let start: Date;
    switch (dateFilter) {
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate).toISOString(),
            end: new Date(customEndDate + 'T23:59:59').toISOString(),
          };
        }
        return null;
      default:
        return null;
    }
    return { start: start.toISOString(), end: now.toISOString() };
  };

  // --- HELPER TO CALCULATE REPORT DATA ---
  const calculateReportData = (logs: any[], studentsToAnalyze: Student[], includeStudentPoints = false): ReportData | ClassWideReportData => {
    const positiveLogs = logs?.filter(l => l.is_positive) || [];
    const allNegative = logs?.filter(l => !l.is_positive) || [];
    const teacherNotesLogs = allNegative.filter(l => l.participation_categories?.name === 'Teacher Note');
    const behavioralAlertLogs = allNegative.filter(l => l.participation_categories?.name !== 'Teacher Note');

    const totalPositive = positiveLogs.reduce((s, l) => s + l.points, 0);
    const totalNegative = behavioralAlertLogs.reduce((s, l) => s + l.points, 0);

    const topPerformers = [...studentsToAnalyze]
      .sort((a, b) => b.total_positive_points - a.total_positive_points)
      .slice(0, 5);

    const needsAttention = [...studentsToAnalyze]
      .filter(s => s.total_positive_points <= 5 || s.total_negative_points >= 10)
      .slice(0, 5);

    // daily trend
    const dailyData: ReportData['dailyData'] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.toISOString().split('T')[0];
      const dayLogs = [...positiveLogs, ...behavioralAlertLogs].filter(l => l.created_at.startsWith(day));
      dailyData.push({
        date: d.toLocaleDateString('en-US', { weekday: 'short' }),
        positive: dayLogs.filter(l => l.is_positive).reduce((s, l) => s + l.points, 0),
        negative: dayLogs.filter(l => !l.is_positive).reduce((s, l) => s + l.points, 0),
      });
    }

    // category breakdown
    const breakdown = categories
      .filter(c => !c.is_positive && c.name !== 'Teacher Note')
      .map(cat => {
        const logsForCat = behavioralAlertLogs.filter(l => l.category_id === cat.id);
        const counts = new Map<string, number>();
        logsForCat.forEach(l => {
          const n = l.students?.name || 'Unknown';
          counts.set(n, (counts.get(n) || 0) + 1);
        });
        const studentsList = Array.from(counts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        return { category: cat, count: logsForCat.length, students: studentsList };
      })
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);

    const baseData: ReportData = {
      totalPositivePoints: totalPositive,
      totalNegativePoints: totalNegative,
      netPoints: totalPositive - totalNegative,
      studentCount: studentsToAnalyze.length,
      averagePositive: studentsToAnalyze.length ? totalPositive / studentsToAnalyze.length : 0,
      averageNegative: studentsToAnalyze.length ? totalNegative / studentsToAnalyze.length : 0,
      topPerformers,
      needsAttention,
      dailyData,
      categoryBreakdown: breakdown,
      teacherNotes: teacherNotesLogs,
    };

    if (includeStudentPoints) {
      const allStudentsWithPoints = studentsToAnalyze.map(student => {
        const studentLogs = logs?.filter(l => l.student_id === student.id) || [];
        const positivePoints = studentLogs.filter(l => l.is_positive).reduce((s, l) => s + l.points, 0);
        const negativePoints = studentLogs.filter(l => !l.is_positive && l.participation_categories?.name !== 'Teacher Note').reduce((s, l) => s + l.points, 0);
        return { student, positivePoints, negativePoints };
      });

      return {
        ...baseData,
        allStudentsWithPoints
      } as ClassWideReportData;
    }

    return baseData;
  };

  // --- GENERATE MAIN REPORT ---
  const generateReport = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const dateRange = getDateFilter();
      let query = supabase
        .from('participation_logs')
        .select(`
          *,
          students!inner(id, name, class_id, total_positive_points, total_negative_points),
          participation_categories(id, name, is_positive, color)
        `)
        .eq('students.class_id', selectedClassId);

      if (dateRange) query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);

      const { data: logs, error } = await query;
      if (error) throw error;

      // Calculate class-wide report data (all students, all logs for date range)
      const classWideData = calculateReportData(logs, students, true) as ClassWideReportData;
      setClassWideReportData(classWideData);

      // Calculate filtered report data (selected student if any)
      const filteredLogs = selectedStudentId ? logs?.filter(l => l.student_id === selectedStudentId) : logs;
      const filteredStudents = selectedStudentId ? students.filter(s => s.id === selectedStudentId) : students;
      const filteredData = calculateReportData(filteredLogs, filteredStudents) as ReportData;
      setReportData(filteredData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- GENERATE AI REPORT (existing) ---
  const generateAIReport = async () => {
    if (!selectedClassId) return;
    setAiGenerating(true);
    try {
      // pull in the main filter's dates
      const dateRange = getDateFilter();
      // update AI‑report state so the header uses the correct dates
      if (dateRange) {
        setAiReportStartDate(dateRange.start);
        setAiReportEndDate(dateRange.end);
      } else {
        setAiReportStartDate('');
        setAiReportEndDate('');
      }

      let query = supabase
        .from('participation_logs')
        .select(`
          *,
          students!inner(id, name, class_id),
          participation_categories(name, is_positive, color)
        `)
        .eq('students.class_id', selectedClassId);

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end);
      }

      if (selectedStudentId) query = query.eq('student_id', selectedStudentId);

      const { data: logs, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      // build markdown report...
      let report = '';
      
      // Determine which students to generate reports for
      let studentsToGenerateFor: Student[] = [];
      if (selectedStudentId) {
        // If a specific student is selected in the main filter, only generate for that student
        const selectedStudent = students.find(s => s.id === selectedStudentId);
        if (selectedStudent) {
          studentsToGenerateFor = [selectedStudent];
        }
      } else {
        // If no specific student is selected, generate for all students in the class
        studentsToGenerateFor = students.filter(s => s.class_id === selectedClassId);
      }
      
      if (studentsToGenerateFor.length === 0) {
        report = 'No students found for the selected criteria.';
      } else if (studentsToGenerateFor.length === 1) {
        // Single student report - no class header needed
        const student = studentsToGenerateFor[0];
        const stuLogs = logs?.filter(l => l.student_id === student.id) || [];
        report = _generateSingleStudentReportContent(
          stuLogs,
          student,
          aiReportStartDate,
          aiReportEndDate,
          aiReportFormat,
          aiReportTone
        );
      } else {
        // Multiple students - generate class report with header
        const className = classes.find(c => c.id === selectedClassId)?.name || 'Class';
        const range = aiReportStartDate && aiReportEndDate
          ? `${new Date(aiReportStartDate).toLocaleDateString()} - ${new Date(aiReportEndDate).toLocaleDateString()}`
          : 'All Time';
        report = `# Class Reports: ${className}\n**Period:** ${range}\n**Generated:** ${new Date().toLocaleDateString()}\n**Students:** ${studentsToGenerateFor.length}\n\n---\n\n`;
        studentsToGenerateFor.forEach((stu, idx) => {
          const stuLogs = logs?.filter(l => l.student_id === stu.id) || [];
          report += _generateSingleStudentReportContent(
            stuLogs,
            stu,
            aiReportStartDate,
            aiReportEndDate,
            aiReportFormat,
            aiReportTone
          );
          if (idx < studentsToGenerateFor.length - 1) report += '\n\n---\n\n';
        });
      }

      setAiReport(report);
      setGeneratedAIReportContent(report);
    } catch (e) {
      console.error(e);
      setAiReport('Error generating report. Please try again.');
      setGeneratedAIReportContent('');
    } finally {
      setAiGenerating(false);
    }
  };

  // --- SINGLE STUDENT REPORT MARKDOWN HELPER ---
  const _generateSingleStudentReportContent = (
    logs: any[],
    student: Student,
    startDate: string,
    endDate: string,
    format: 'detailed' | 'summary',
    tone: 'formal' | 'friendly' | 'parent'
  ): string => {
    const positiveLogs = logs.filter(l => l.is_positive);
    const negativeLogs = logs.filter(l => !l.is_positive);
    const teacherNotes = negativeLogs.filter(l => l.participation_categories?.name === 'Teacher Note');
    const behavioralAlerts = negativeLogs.filter(l => l.participation_categories?.name !== 'Teacher Note');

    const totalPositive = positiveLogs.reduce((sum, log) => sum + log.points, 0);
    const totalNegative = behavioralAlerts.reduce((sum, log) => sum + log.points, 0);

    let report = `## ${student.name}\n\n`;

    // Summary stats
    report += `**Participation Points:** ${totalPositive}\n`;

    if (format === 'detailed') {
      // Behavioral alerts details
      if (behavioralAlerts.length > 0) {
        report += `### Areas for Improvement\n`;
        const alertsByCategory = new Map<string, number>();
        behavioralAlerts.forEach(log => {
          const categoryName = log.participation_categories?.name || 'Unknown';
          alertsByCategory.set(categoryName, (alertsByCategory.get(categoryName) || 0) + 1);
        });
        
        Array.from(alertsByCategory.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([category, count]) => {
            report += `- **${category}:** ${count} time${count !== 1 ? 's' : ''}\n`;
          });
        report += '\n';
      }

      // Teacher notes
      if (teacherNotes.length > 0) {
        report += `### Teacher Notes (${teacherNotes.length})\n`;
        teacherNotes.slice(0, 5).forEach((note, idx) => {
          const date = new Date(note.created_at).toLocaleDateString();
          report += `**${date}:** ${note.notes || 'No content recorded'}\n\n`;
        });
      }
    }

    return report;
  };

  // --- DIRECT-GENERATE WITH DEFAULTS ---
  const handleGenerateDefaultAIReport = async () => {
    if (!selectedClassId) {
      alert('Please select a class first.');
      return;
    }
    // reset any prior AI state
    setAiReport('');
    setGeneratedAIReportContent('');
    setAiReportStudent('');
    setAiReportStartDate('');
    setAiReportEndDate('');
    setAiReportFormat('detailed');
    setAiReportTone('formal');

    setLoadingAIReport(true);
    try {
      await generateAIReport();
    } finally {
      setLoadingAIReport(false);
    }
  };

  // --- EXPORT / DOWNLOAD HELPERS ---
  const exportReport = async (format: 'csv') => {
    if (!reportData) return;
    
    try {
      // Get class name
      const className = classes.find(c => c.id === selectedClassId)?.name || 'Class';
      
      // Get date range string
      const getDateRangeString = () => {
        const dateRange = getDateFilter();
        if (dateRange) {
          const startDate = new Date(dateRange.start).toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: 'numeric' 
          });
          const endDate = new Date(dateRange.end).toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: 'numeric' 
          });
          return `${startDate} to ${endDate}`;
        }
        return 'All Time';
      };
      
      // Define the exact column order and names as specified
      const columnHeaders = [
        'Name',
        'Points', 
        'No Feedback‑Seeking / Use',
        'Passive Participation',
        'Off-Task / Distracted',
        'Inauthentic Work',
        'Not Following Directions',
        'Needs Support to Engage',
        'Unprepared for Class',
        'Low Effort / Incomplete Work'
      ];
      
      // Fetch all participation logs for the class and date range
      const dateRange = getDateFilter();
      let query = supabase
        .from('participation_logs')
        .select(`
          *,
          students!inner(id, name, class_id),
          participation_categories(id, name, is_positive)
        `)
        .eq('students.class_id', selectedClassId);
      
      if (dateRange) {
        query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
      }
      
      const { data: logs, error } = await query;
      if (error) throw error;
      
      // Build CSV data
      const csvData = [];
      
      // Header row 1: Class name and date range
      const headerRow1 = [className, '', '', '', '', '', '', '', '', ''];
      csvData.push(headerRow1);
      
      // Header row 2: Date range with column headers
      const headerRow2 = [getDateRangeString(), 'Points', 'No Feedback‑Seeking / Use', 'Passive Participation', 'Off-Task / Distracted', 'Inauthentic Work', 'Not Following Directions', 'Needs Support to Engage', 'Unprepared for Class', 'Low Effort / Incomplete Work'];
      csvData.push(headerRow2);
      
      // Use students array instead of classWideReportData.allStudentsWithPoints
      students.forEach(student => {
        // Get student's logs for this date range
        const studentLogs = logs?.filter(log => log.student_id === student.id) || [];
        
        // Calculate positive points (excluding Teacher Note)
        const positiveLogs = studentLogs.filter(log => log.is_positive);
        const positivePoints = positiveLogs.reduce((sum, log) => sum + log.points, 0);
        
        // Create a map to store flag counts by category name
        const flagCountsByCategory: { [key: string]: number } = {};
        
        // Initialize all flag categories to 0
        const flagCategories = [
          'No Feedback‑Seeking / Use',
          'Passive Participation',
          'Off-Task / Distracted',
          'Inauthentic Work',
          'Not Following Directions',
          'Needs Support to Engage',
          'Unprepared for Class',
          'Low Effort / Incomplete Work'
        ];
        
        flagCategories.forEach(categoryName => {
          flagCountsByCategory[categoryName] = 0;
        });
        
        // Count actual flags by category name
        studentLogs.forEach(log => {
          if (!log.is_positive && log.participation_categories?.name !== 'Teacher Note') {
            const categoryName = log.participation_categories?.name;
            if (categoryName && flagCountsByCategory.hasOwnProperty(categoryName)) {
              flagCountsByCategory[categoryName]++;
            }
          }
        });
        
        // Build row in exact column order
        const row = [
          student.name,
          positivePoints.toString(),
          flagCountsByCategory['No Feedback‑Seeking / Use'].toString(),
          flagCountsByCategory['Passive Participation'].toString(),
          flagCountsByCategory['Off-Task / Distracted'].toString(),
          flagCountsByCategory['Inauthentic Work'].toString(),
          flagCountsByCategory['Not Following Directions'].toString(),
          flagCountsByCategory['Needs Support to Engage'].toString(),
          flagCountsByCategory['Unprepared for Class'].toString(),
          flagCountsByCategory['Low Effort / Incomplete Work'].toString()
        ];
        
        csvData.push(row);
      });
      
      // Convert to CSV string
      const csvContent = csvData.map(row => 
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${className.toLowerCase().replace(/\s+/g, '-')}-participation-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting CSV. Please try again.');
    }
  };

  const downloadAIReport = () => {
    if (!aiReportContentRef.current) return;

    const element = aiReportContentRef.current;
    const opt = {
      margin: 1,
      filename: `ai-report-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  // --- ANALYTICS CALCULATIONS ---
  const getAnalyticsData = () => {
    if (!classWideReportData || !reportData) return null;

    const classAveragePositivePoints = classWideReportData.averagePositive;
    
    let studentComparisonMessage = '';
    let studentRankMessage = '';
    let studentFlagsByCategoryComparison: { category: ParticipationCategory; studentCount: number; classAverage: number }[] = [];

    if (selectedStudentId && classWideReportData.allStudentsWithPoints.length > 0) {
      const selectedStudentData = classWideReportData.allStudentsWithPoints.find(s => s.student.id === selectedStudentId);
      
      if (selectedStudentData) {
        // Student vs Class Average comparison
        const studentPoints = selectedStudentData.positivePoints;
        const studentName = selectedStudentData.student.name.split(' ')[0];
        
        if (studentPoints > classAveragePositivePoints) {
          studentComparisonMessage = `${studentName} has ${studentPoints} points — above the class average of ${Math.round(classAveragePositivePoints)}.`;
        } else if (studentPoints < classAveragePositivePoints) {
          studentComparisonMessage = `${studentName} has ${studentPoints} points — below the class average of ${Math.round(classAveragePositivePoints)}.`;
        } else {
          studentComparisonMessage = `${studentName} has ${studentPoints} points — exactly at the class average of ${Math.round(classAveragePositivePoints)}.`;
        }

        // Student rank calculation
        const sortedStudents = [...classWideReportData.allStudentsWithPoints]
          .sort((a, b) => {
            if (b.positivePoints !== a.positivePoints) {
              return b.positivePoints - a.positivePoints;
            }
            // Tie-breaking: use student name alphabetically for consistency
            return a.student.name.localeCompare(b.student.name);
          });

        const studentRank = sortedStudents.findIndex(s => s.student.id === selectedStudentId) + 1;
        const totalStudents = sortedStudents.length;
        
        const getRankSuffix = (rank: number) => {
          if (rank % 100 >= 11 && rank % 100 <= 13) return 'th';
          switch (rank % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
          }
        };

        studentRankMessage = `${studentRank}${getRankSuffix(studentRank)} out of ${totalStudents} students`;

        // Student flags by category comparison
        studentFlagsByCategoryComparison = categories
          .filter(c => !c.is_positive && c.name !== 'Teacher Note')
          .map(category => {
            const studentFlagCount = reportData.categoryBreakdown.find(cb => cb.category.id === category.id)?.count || 0;
            const classFlagCount = classWideReportData.categoryBreakdown.find(cb => cb.category.id === category.id)?.count || 0;
            const classAverage = classWideReportData.studentCount > 0 ? classFlagCount / classWideReportData.studentCount : 0;
            
            return {
              category,
              studentCount: studentFlagCount,
              classAverage: Math.round(classAverage)
            };
          });
      }
    }

    // Class flags by category
    const classFlagsByCategory = categories
      .filter(c => !c.is_positive && c.name !== 'Teacher Note')
      .map(category => {
        let categoryData, totalFlags, classAverage;
        
        if (selectedStudentId) {
          // When student is selected, show student's individual data
          categoryData = reportData.categoryBreakdown.find(cb => cb.category.id === category.id);
          totalFlags = categoryData?.count || 0;
          classAverage = 0; // Not used for individual student view
        } else {
          // When showing class data, show class totals
          categoryData = classWideReportData.categoryBreakdown.find(cb => cb.category.id === category.id);
          totalFlags = categoryData?.count || 0;
          classAverage = classWideReportData.studentCount > 0 ? totalFlags / classWideReportData.studentCount : 0;
        }
        
        return {
          category,
          totalFlags,
         classAverage: Math.round(classAverage)
        };
      })
      .filter(item => item.totalFlags > 0)
      .sort((a, b) => b.totalFlags - a.totalFlags);

    return {
      classAveragePositivePoints: Math.round(classAveragePositivePoints),
      studentComparisonMessage,
      studentRankMessage,
      classFlagsByCategory,
      studentFlagsByCategoryComparison
    };
  };

  const analyticsData = getAnalyticsData();

  const maxPoints = Math.max(
    ...(reportData?.dailyData.map(d => Math.max(d.positive, d.negative)) || [1])
  );

  return (
    <div className="min-h-screen bg-gray-50 overflow-hidden">
      <div className="container mx-auto px-4 py-6">
        {/* HEADER */}
        <div className="flex items-center mb-8 space-x-4">
          <button
            onClick={onNavigateBack}
            className="p-3 bg-white rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
              Reports & Analytics
            </h1>
            <p className="text-gray-600 text-sm">
              Track participation trends and student progress
            </p>
          </div>
        </div>

        {/* FILTERS & OPTIONS */}
        <div className="bg-white rounded-2xl p-6 mb-8 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-gray-900" />
            Filters & Options
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Class */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Class
              </label>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 border rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Student */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Student (Optional)
              </label>
              <select
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 border rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="">All Students</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Period */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Time Period
              </label>
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-100 border rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="daily">Today</option>
                <option value="weekly">Last 7 Days</option>
                <option value="total">All Time</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Export CSV */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Export
              </label>
              <button
                onClick={async () => await exportReport('csv')}
                disabled={!reportData}
                className="w-full px-3 py-2 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>CSV</span>
              </button>
            </div>

            {/* AI Report Assistant */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Report Assistant
              </label>
              <button
                onClick={handleGenerateDefaultAIReport}
                disabled={!selectedClassId || loadingAIReport}
                className="w-full px-3 py-2 bg-green-500 rounded-lg text-white hover:bg-green-600 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <Bot className="w-4 h-4" />
                <span>{loadingAIReport ? 'Generating…' : 'Generate'}</span>
              </button>
            </div>
          </div>

          {/* Custom Range Inputs */}
          {dateFilter === 'custom' && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 border rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 border rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* MAIN REPORT OR LOADING */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-600">Generating report…</p>
          </div>
        ) : reportData ? (
          <>
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <div className="flex justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Points</h3>
                  <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-2xl font-bold text-green-400">
                  {reportData.totalPositivePoints}
                </p>
              </div>
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <div className="flex justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Participation Flags</h3>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-2xl font-bold text-red-400">
                  {reportData.totalNegativePoints}
                </p>
              </div>
            </div>

            {/* CHARTS: Daily Trend & Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Daily Trend */}
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="flex items-center mb-4 text-lg font-bold text-gray-900">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Daily Trend (Last 7 Days)
                </h3>
                <div className="space-y-3">
                  {reportData.dailyData.map((day, i) => (
                    <div key={i} className="flex items-center space-x-3">
                      <span className="w-8 text-xs text-gray-600">
                        {day.date}
                      </span>
                      <div className="flex-1 flex space-x-1">
                        <div
                          className="bg-green-500/30 border border-green-500/50 rounded h-6 flex items-center justify-center"
                          style={{
                            width: `${Math.max((day.positive / maxPoints) * 100, 5)}%`,
                          }}
                        >
                          <span className="text-xs text-green-700 font-bold">
                            {day.positive}
                          </span>
                        </div>
                        <div
                          className="bg-orange-500/30 border border-red-500/50 rounded h-6 flex items-center justify-center"
                          style={{
                            width: `${Math.max((day.negative / maxPoints) * 100, 5)}%`,
                          }}
                        >
                          <span className="text-xs text-red-700 font-bold">
                            {day.negative}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center mt-4 space-x-4 text-xs">
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-green-500/30 border border-green-500/50 rounded"></span>
                    <span className="text-gray-600">Points</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-orange-500/30 border border-red-500/50 rounded"></span>
                    <span className="text-gray-600">Participation Flags</span>
                  </div>
                </div>
              </div>

              {/* Distribution */}
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="flex items-center mb-4 text-lg font-bold text-gray-900">
                  <PieChart className="w-5 h-5 mr-2" />
                  Distribution
                </h3>
                <div className="flex justify-center mb-6">
                  <div className="relative w-32 h-32">
                    <svg
                      className="absolute inset-0 transform -rotate-90"
                      viewBox="0 0 100 100"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#374151"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#22c55e"
                        strokeWidth="8"
                        strokeDasharray={`${(reportData.totalPositivePoints / (reportData.totalPositivePoints + reportData.totalNegativePoints || 1)) * 251.2} 251.2`}
                        strokeLinecap="round"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#f97316"
                        strokeWidth="8"
                        strokeDasharray={`${(reportData.totalNegativePoints / (reportData.totalPositivePoints + reportData.totalNegativePoints || 1)) * 251.2} 251.2`}
                        strokeDashoffset={`-${(reportData.totalPositivePoints / (reportData.totalPositivePoints + reportData.totalNegativePoints || 1)) * 251.2}`}
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">
                          {Math.round(
                            (reportData.totalPositivePoints /
                              (reportData.totalPositivePoints +
                                reportData.totalNegativePoints || 1)) *
                              100
                          )}
                          %
                        </div>
                        <div className="text-xs text-gray-500">Positive</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      <span className="text-sm text-gray-600">Points</span>
                    </div>
                    <span className="font-bold text-green-400">
                      {reportData.totalPositivePoints}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                      <span className="text-sm text-gray-600">Participation Flags</span>
                    </div>
                    <span className="font-bold text-red-400">
                      {reportData.totalNegativePoints}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* PARTICIPATION POINTS ANALYTICS */}
            {analyticsData && (
              <div className="bg-white p-6 rounded-2xl border shadow-sm mb-8">
                <h3 className="flex items-center mb-6 text-lg font-bold text-gray-900">
                  <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
                  Participation Points Analytics
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Class Average */}
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">Class Average Points</h4>
                    <p className="text-2xl font-bold text-blue-600">
                      {analyticsData.classAveragePositivePoints}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">per student</p>
                  </div>

                  {/* Student vs Class Average */}
                  {selectedStudentId && analyticsData.studentComparisonMessage && (
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                      <h4 className="text-sm font-medium text-green-800 mb-2">Student vs Class Average</h4>
                      <p className="text-sm text-green-700 leading-relaxed">
                        {analyticsData.studentComparisonMessage}
                      </p>
                    </div>
                  )}

                  {/* Student Rank */}
                  {selectedStudentId && analyticsData.studentRankMessage && (
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                      <h4 className="text-sm font-medium text-purple-800 mb-2">Student Rank in Class</h4>
                      <p className="text-lg font-bold text-purple-600">
                        {analyticsData.studentRankMessage}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">based on total points</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CATEGORY BREAKDOWN */}
            {reportData.categoryBreakdown.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border shadow-sm mb-8 hidden">
                <h3 className="flex items-center mb-6 text-lg font-bold text-gray-900">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Participation Flags{selectedStudentId && students.find(s => s.id === selectedStudentId) ? ` (${students.find(s => s.id === selectedStudentId)?.name})` : ''}
                </h3>
                <div className="space-y-4">
                  {reportData.categoryBreakdown.map(item => (
                    <div
                      key={item.category.id}
                      className="border rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setShowCategoryDetails(prev => ({
                            ...prev,
                            [item.category.id]: !prev[item.category.id],
                          }))
                        }
                        className="w-full p-4 bg-gray-50 flex justify-between items-center hover:bg-gray-100 transition"
                      >
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.category.color }}
                          ></span>
                          <div>
                            <h4 className="font-medium text-gray-900 m-0">
                              {item.category.name}
                            </h4>
                            <p className="text-sm text-gray-600 m-0">
                              {item.count} participation flag
                              {item.count !== 1 ? 's' : ''}
                              {!selectedStudentId &&
                                ` • ${item.students.length} student${
                                  item.students.length !== 1 ? 's' : ''
                                }`}
                            </p>
                          </div>
                        </div>
                        {showCategoryDetails[item.category.id] ? (
                          <EyeOff className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      {showCategoryDetails[item.category.id] && (
                        <div className="p-4 bg-gray-50 border-t">
                          {!selectedStudentId && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {item.students.map((stu, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between p-3 bg-white rounded-lg border"
                                >
                                  <span className="text-sm text-gray-900">
                                    {stu.name}
                                  </span>
                                  <span className="font-bold text-orange-400 text-sm">
                                    {stu.count} time
                                    {stu.count !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {!selectedStudentId && (
                            <div className="mt-4 pt-3 border-t text-xs text-gray-600">
                              Most frequent:{' '}
                              <span className="font-medium text-gray-900">
                                {item.students[0]?.name || 'N/A'} (
                                {item.students[0]?.count || 0})
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PARTICIPATION FLAGS ANALYTICS */}
            {analyticsData && analyticsData.classFlagsByCategory.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border shadow-sm mb-8">
                <h3 className="flex items-center mb-6 text-lg font-bold text-gray-900">
                  <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
                  Participation Flags Analytics
                </h3>
                
                {/* Average Participation Flags Per Category (Class Level) */}
                <div className="mb-8">
                  <div className="space-y-3">
                    {analyticsData.classFlagsByCategory.map((item, index) => (
                      <div key={item.category.id} className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.category.color }}
                          ></span>
                          <span className="text-sm text-gray-700 truncate">{item.category.name}</span>
                        </div>
                        <div className="flex items-center space-x-4 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {selectedStudentId ? `${item.totalFlags}` : `${item.totalFlags} total`}
                            </div>
                          </div>
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                backgroundColor: item.category.color,
                                width: `${Math.min((item.totalFlags / Math.max(...analyticsData.classFlagsByCategory.map(c => c.totalFlags), 1)) * 100, 100)}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Student vs Class in Flags (only when student is selected) */}
                {selectedStudentId && analyticsData.studentFlagsByCategoryComparison.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-800 mb-4">Student vs Class Average (Flags)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analyticsData.studentFlagsByCategoryComparison.map((item) => (
                        <div key={item.category.id} className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                          <div className="flex items-center space-x-2 mb-3">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.category.color }}
                            ></span>
                            <h5 className="font-medium text-gray-900 text-sm">{item.category.name}</h5>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="text-lg font-bold text-orange-600">{item.studentCount}</div>
                              <div className="text-xs text-orange-600"></div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-gray-600">{item.classAverage}</div>
                              <div className="text-xs text-gray-600">Class Avg</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TEACHER NOTES */}
            {reportData.teacherNotes.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border shadow-sm mb-8">
                <h3 className="flex items-center mb-6 text-lg font-bold text-gray-900">
                  <MessageSquare className="w-5 h-5 mr-2 text-blue-500" />
                  Teacher Notes ({reportData.teacherNotes.length})
                </h3>
                <div className="space-y-4">
                  {reportData.teacherNotes.map((note, idx) => {
                    const stu = students.find(s => s.id === note.student_id);
                    return (
                      <div
                        key={idx}
                        className="bg-blue-50 p-4 rounded-xl border border-blue-200"
                      >
                        <div className="flex justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                            <span className="font-medium text-gray-900 text-sm">
                              {stu?.name || 'Unknown'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(note.created_at).toLocaleDateString()}{' '}
                            {new Date(note.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {note.notes || 'No content recorded'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI GENERATED REPORT */}
            {generatedAIReportContent && (
              <div className="bg-white p-6 rounded-2xl border shadow-sm mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="flex items-center text-lg font-bold text-gray-900">
                    <Bot className="w-5 h-5 mr-2 text-green-500" />
                    Generated Report
                  </h3>
                  <button
                    onClick={downloadAIReport}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
                <div ref={aiReportContentRef} className="bg-white p-8 rounded-lg border">
                  <div className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-gray-700 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-li:text-gray-700">
                    <ReactMarkdown>
                      {generatedAIReportContent}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center glow animate-float">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Select a class to view reports
            </h2>
            <p className="text-gray-600">Choose a class from above to generate analytics</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;