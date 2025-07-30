// src/components/ReportsPage.tsx
import React, { useState, useEffect } from 'react';
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

  // --- PDF GENERATION STATE ---
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

    // category breakdown - include all categories, even if count is 0
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
      .sort((a, b) => b.count - a.count);

    // Calculate proper averages based on student totals
    const totalStudentPositivePoints = studentsToAnalyze.reduce((sum, student) => sum + student.total_positive_points, 0);
    const totalStudentNegativePoints = studentsToAnalyze.reduce((sum, student) => sum + student.total_negative_points, 0);
    
    const averagePositive = studentsToAnalyze.length ? totalStudentPositivePoints / studentsToAnalyze.length : 0;
    const averageNegative = studentsToAnalyze.length ? totalStudentNegativePoints / studentsToAnalyze.length : 0;

    const baseData: ReportData = {
      totalPositivePoints: totalPositive,
      totalNegativePoints: totalNegative,
      netPoints: totalPositive - totalNegative,
      studentCount: studentsToAnalyze.length,
      averagePositive,
      averageNegative,
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



  // --- DIRECT-GENERATE WITH DEFAULTS ---
  const handleGenerateDefaultAIReport = async () => {
    if (!selectedClassId) {
      alert('Please select a class first.');
      return;
    }
    
    setLoadingAIReport(true);
    try {
      // Generate the report data first
      await generateReport();
      
      // Create comprehensive PDF content with all visuals
      const className = classes.find(c => c.id === selectedClassId)?.name || 'Class';
      const dateRange = getDateFilter();
      const dateRangeString = dateRange 
        ? `${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`
        : 'All Time';
      
             // Create the PDF content element
       const pdfContent = document.createElement('div');
       pdfContent.className = 'pdf-content bg-white p-8';
       pdfContent.style.fontFamily = 'Arial, sans-serif';
       pdfContent.style.maxWidth = '900px';
       pdfContent.style.margin = '0 auto';
      
      // Header
      const header = document.createElement('div');
      header.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px;">
          <h1 style="font-size: 28px; font-weight: bold; color: #111827; margin: 0 0 10px 0;">Reports & Analytics</h1>
          <h2 style="font-size: 20px; color: #374151; margin: 0 0 5px 0;">${className}</h2>
          <p style="font-size: 14px; color: #6b7280; margin: 0;">Period: ${dateRangeString}</p>
          <p style="font-size: 14px; color: #6b7280; margin: 0;">Generated: ${new Date().toLocaleDateString()}</p>
        </div>
      `;
      pdfContent.appendChild(header);
      
      // Summary Cards
      if (reportData) {
        const summarySection = document.createElement('div');
        summarySection.innerHTML = `
          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 15px;">Summary</h3>
            <div style="display: flex; gap: 20px; margin-bottom: 20px;">
              <div style="flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 12px; color: #6b7280; font-weight: 500;">Total Points</span>
                  <span style="color: #22c55e;">✓</span>
                </div>
                <div style="font-size: 24px; font-weight: bold; color: #22c55e;">${reportData.totalPositivePoints}</div>
              </div>
              <div style="flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 12px; color: #6b7280; font-weight: 500;">Participation Flags</span>
                  <span style="color: #ef4444;">⚠</span>
                </div>
                <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${reportData.totalNegativePoints}</div>
              </div>
            </div>
          </div>
        `;
        pdfContent.appendChild(summarySection);
        
                 // Daily Trend Chart
         const dailyTrendSection = document.createElement('div');
         dailyTrendSection.innerHTML = `
           <div style="margin-bottom: 30px;">
             <h3 style="font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 15px;">Daily Trend (Last 7 Days)</h3>
             <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
         `;
         
         const maxPoints = Math.max(...reportData.dailyData.map(d => Math.max(d.positive, d.negative)));
         reportData.dailyData.forEach((day, i) => {
           const positiveWidth = Math.max((day.positive / maxPoints) * 100, 5);
           const negativeWidth = Math.max((day.negative / maxPoints) * 100, 5);
           
           dailyTrendSection.innerHTML += `
             <div style="display: flex; align-items: center; margin-bottom: 12px;">
               <span style="width: 40px; font-size: 12px; color: #6b7280; flex-shrink: 0;">${day.date}</span>
               <div style="flex: 1; display: flex; gap: 2px; margin-left: 10px; height: 24px;">
                 <div style="background: rgba(34, 197, 94, 0.3); border: 1px solid rgba(34, 197, 94, 0.5); border-radius: 4px; height: 24px; width: ${positiveWidth}%; min-width: 20px; display: flex; align-items: center; justify-content: center; text-align: center;">
                   <span style="font-size: 10px; color: #15803d; font-weight: bold; line-height: 24px; display: inline-block; width: 100%; padding-bottom: 12px;">${day.positive}</span>
                 </div>
                 <div style="background: rgba(239, 68, 68, 0.3); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 4px; height: 24px; width: ${negativeWidth}%; min-width: 20px; display: flex; align-items: center; justify-content: center; text-align: center;">
                   <span style="font-size: 10px; color: #dc2626; font-weight: bold; line-height: 24px; display: inline-block; width: 100%; padding-bottom: 12px;">${day.negative}</span>
                 </div>
               </div>
             </div>
           `;
         });
        
        dailyTrendSection.innerHTML += `
              <div style="display: flex; justify-content: center; gap: 20px; margin-top: 15px; font-size: 12px;">
                <div style="display: flex; align-items: center; gap: 5px;">
                  <span style="width: 12px; height: 12px; background: rgba(34, 197, 94, 0.3); border: 1px solid rgba(34, 197, 94, 0.5); border-radius: 2px; margin-top: 15px"></span>
                  <span style="color: #6b7280;">Points</span>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                  <span style="width: 12px; height: 12px; background: rgba(239, 68, 68, 0.3); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 2px; margin-top: 15px"></span>
                  <span style="color: #6b7280;">Participation Flags</span>
                </div>
              </div>
            </div>
          </div>
        `;
        pdfContent.appendChild(dailyTrendSection);
        
        // Distribution Chart
        const distributionSection = document.createElement('div');
        const totalPoints = reportData.totalPositivePoints + reportData.totalNegativePoints;
        const positivePercentage = totalPoints > 0 ? Math.round((reportData.totalPositivePoints / totalPoints) * 100) : 0;
        
        distributionSection.innerHTML = `
          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 15px;">Distribution</h3>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center;">
              <div style="position: relative; width: 120px; height: 120px; margin: 0 auto 20px;">
                <svg style="position: absolute; top: 0; left: 0; transform: rotate(-90deg);" width="120" height="120" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#374151" stroke-width="8" fill="none"/>
                  <circle cx="50" cy="50" r="40" stroke="#22c55e" stroke-width="8" stroke-dasharray="${(reportData.totalPositivePoints / totalPoints || 0) * 251.2} 251.2" stroke-linecap="round" fill="none"/>
                  <circle cx="50" cy="50" r="40" stroke="#f97316" stroke-width="8" stroke-dasharray="${(reportData.totalNegativePoints / totalPoints || 0) * 251.2} 251.2" stroke-dashoffset="-${(reportData.totalPositivePoints / totalPoints || 0) * 251.2}" stroke-linecap="round" fill="none"/>
                </svg>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                  <div style="font-size: 18px; font-weight: bold; color: #111827;">${positivePercentage}%</div>
                  <div style="font-size: 10px; color: #6b7280;">Positive</div>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; max-width: 200px; margin: 0 auto;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="width: 12px; height: 12px; background: #22c55e; border-radius: 50%; margin-top: 15px"></span>
                  <span style="font-size: 12px; color: #6b7280;">Points</span>
                </div>
                <span style="font-weight: bold; color: #22c55e;">${reportData.totalPositivePoints}</span>
              </div>
              <div style="display: flex; justify-content: space-between; max-width: 200px; margin: 10px auto 0;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="width: 12px; height: 12px; background: #f97316; border-radius: 50%; margin-top: 15px"></span>
                  <span style="font-size: 12px; color: #6b7280;">Participation Flags</span>
                </div>
                <span style="font-weight: bold; color: #ef4444;">${reportData.totalNegativePoints}</span>
              </div>
            </div>
          </div>
        `;
        pdfContent.appendChild(distributionSection);
        
                 // Analytics Section
         if (analyticsData) {
           const analyticsSection = document.createElement('div');
           analyticsSection.innerHTML = `
             <div style="margin-bottom: 30px;">
               <h3 style="font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 15px;">Participation Points Analytics</h3>
               <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                 <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 15px;">
                   <h4 style="font-size: 12px; font-weight: 500; color: #1e40af; margin-bottom: 8px;">Class Average Points</h4>
                   <p style="font-size: 20px; font-weight: bold; color: #2563eb; margin: 0;">${analyticsData.classAveragePositivePoints}</p>
                   <p style="font-size: 10px; color: #2563eb; margin: 5px 0 0 0;">per student</p>
                 </div>
                 <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px;">
                   <h4 style="font-size: 12px; font-weight: 500; color: #166534; margin-bottom: 8px;">Total Points</h4>
                   <p style="font-size: 20px; font-weight: bold; color: #22c55e; margin: 0;">${reportData.totalPositivePoints}</p>
                   <p style="font-size: 10px; color: #22c55e; margin: 5px 0 0 0;">this period</p>
                 </div>
                 <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px;">
                   <h4 style="font-size: 12px; font-weight: 500; color: #991b1b; margin-bottom: 8px;">Participation Flags</h4>
                   <p style="font-size: 20px; font-weight: bold; color: #ef4444; margin: 0;">${reportData.totalNegativePoints}</p>
                   <p style="font-size: 10px; color: #ef4444; margin: 5px 0 0 0;">this period</p>
                 </div>
           `;
          
          if (selectedStudentId && analyticsData.studentComparisonMessage) {
            analyticsSection.innerHTML += `
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px;">
                <h4 style="font-size: 12px; font-weight: 500; color: #166534; margin-bottom: 8px;">Student vs Class Average</h4>
                <p style="font-size: 12px; color: #15803d; line-height: 1.4; margin: 0;">${analyticsData.studentComparisonMessage}</p>
              </div>
            `;
          }
          
          if (selectedStudentId && analyticsData.studentRankMessage) {
            analyticsSection.innerHTML += `
              <div style="background: #faf5ff; border: 1px solid #c4b5fd; border-radius: 8px; padding: 15px;">
                <h4 style="font-size: 12px; font-weight: 500; color: #7c3aed; margin-bottom: 8px;">Student Rank in Class</h4>
                <p style="font-size: 16px; font-weight: bold; color: #7c3aed; margin: 0;">${analyticsData.studentRankMessage}</p>
                <p style="font-size: 10px; color: #7c3aed; margin: 5px 0 0 0;">based on total points</p>
              </div>
            `;
          }
          
          analyticsSection.innerHTML += `</div></div>`;
          pdfContent.appendChild(analyticsSection);
        }
        
                 // Participation Flags Analytics
         if (analyticsData) {
           const flagsSection = document.createElement('div');
           flagsSection.innerHTML = `
             <div style="margin-bottom: 30px;">
               <h3 style="font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 15px;">Participation Flags Analytics</h3>
               <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
           `;
           
           // Check if there are any flags in the current period (not just class-wide)
           const hasFlagsInPeriod = reportData && reportData.totalNegativePoints > 0;
           
           if (hasFlagsInPeriod && analyticsData.classFlagsByCategory.some(item => item.totalFlags > 0)) {
             analyticsData.classFlagsByCategory.forEach((item, index) => {
               const maxFlags = Math.max(...analyticsData.classFlagsByCategory.map(c => c.totalFlags));
               const barWidth = maxFlags > 0 ? (item.totalFlags / maxFlags) * 100 : 0;
               
               flagsSection.innerHTML += `
                 <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
                   <div style="display: flex; align-items: flex-start; min-width: 0; flex: 1; margin-right: 20px;">
                     <span style="width: 12px; height: 12px; border-radius: 50%; margin-right: 10px; margin-top: 2px; background-color: ${item.category.color}; flex-shrink: 0;"></span>
                     <div style="font-size: 12px; color: #374151; word-wrap: break-word; line-height: 1.4; max-width: 200px;">${item.category.name}</div>
                   </div>
                   <div style="display: flex; align-items: center; gap: 15px; flex-shrink: 0;">
                     <div style="text-align: right;">
                       <div style="font-size: 12px; font-weight: 500; color: #111827;">
                         ${selectedStudentId ? `${item.totalFlags}` : `${item.totalFlags} total`}
                       </div>
                     </div>
                     <div style="width: 100px; background: #e5e7eb; border-radius: 4px; height: 8px;">
                       <div style="height: 8px; border-radius: 4px; width: ${barWidth}%; background-color: ${item.category.color};"></div>
                     </div>
                   </div>
                 </div>
               `;
             });
           } else {
             flagsSection.innerHTML += `
               <div style="text-align: center; padding: 30px;">
                 <div style="color: #6b7280; font-size: 14px; font-weight: 500;">
                   No participation flags recorded for this period
                 </div>
               </div>
             `;
           }
           
           flagsSection.innerHTML += `</div></div>`;
           pdfContent.appendChild(flagsSection);
         }
      }
      
      // Add the PDF content to the DOM temporarily
      document.body.appendChild(pdfContent);
      
      // Generate PDF
      const opt = {
        margin: 0.5,
        filename: `${className.toLowerCase().replace(/\s+/g, '-')}-comprehensive-report-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      
      await html2pdf().set(opt).from(pdfContent).save();
      
      // Clean up
      document.body.removeChild(pdfContent);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
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



  // --- ANALYTICS CALCULATIONS ---
  const getAnalyticsData = () => {
    if (!classWideReportData || !reportData) return null;
    
    // Ensure we have valid data
    if (!Array.isArray(categories) || categories.length === 0) return null;

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
      .sort((a, b) => b.totalFlags - a.totalFlags);

    const result = {
      classAveragePositivePoints: Math.round(classAveragePositivePoints),
      studentComparisonMessage,
      studentRankMessage,
      classFlagsByCategory,
      studentFlagsByCategoryComparison
    };
    
    // Debug logging to ensure data is calculated properly
    console.log('Analytics Data:', {
      classAveragePositivePoints: result.classAveragePositivePoints,
      classFlagsByCategory: result.classFlagsByCategory.length,
      hasFlagsInPeriod: reportData.totalNegativePoints > 0,
      totalNegativePoints: reportData.totalNegativePoints
    });
    
    return result;
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

            {/* Generate PDF Report */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Generate PDF Report
              </label>
              <button
                onClick={handleGenerateDefaultAIReport}
                disabled={!selectedClassId || loadingAIReport}
                className="w-full px-3 py-2 bg-green-500 rounded-lg text-white hover:bg-green-600 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>{loadingAIReport ? 'Generating PDF…' : 'Generate PDF'}</span>
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
            {analyticsData && (
              <div className="bg-white p-6 rounded-2xl border shadow-sm mb-8">
                <h3 className="flex items-center mb-6 text-lg font-bold text-gray-900">
                  <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
                  Participation Flags Analytics
                </h3>
                
                                {/* Average Participation Flags Per Category (Class Level) */}
                <div className="mb-8">
                  {/* Check if there are any flags in the current period (not just class-wide) */}
                  {reportData && reportData.totalNegativePoints > 0 && analyticsData.classFlagsByCategory.some(item => item.totalFlags > 0) ? (
                    <div className="space-y-3">
                      {analyticsData.classFlagsByCategory.map((item, index) => (
                        <div key={item.category.id} className="flex items-start space-x-4">
                          <div className="flex items-start space-x-2 min-w-0 flex-1">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                              style={{ backgroundColor: item.category.color }}
                            ></span>
                            <span className="text-sm text-gray-700 break-words leading-relaxed">{item.category.name}</span>
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
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-500 text-sm font-medium">
                        No participation flags recorded for this period
                      </div>
                    </div>
                  )}
                </div>

                {/* Student vs Class in Flags (only when student is selected) */}
                {selectedStudentId && analyticsData.studentFlagsByCategoryComparison.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-800 mb-4">Student vs Class Average (Flags)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analyticsData.studentFlagsByCategoryComparison.map((item) => (
                        <div key={item.category.id} className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                          <div className="flex items-start space-x-2 mb-3">
                            <span
                              className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                              style={{ backgroundColor: item.category.color }}
                            ></span>
                            <h5 className="font-medium text-gray-900 text-sm break-words leading-relaxed">{item.category.name}</h5>
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