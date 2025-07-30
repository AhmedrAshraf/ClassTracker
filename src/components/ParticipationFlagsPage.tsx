import React from 'react';
import { ArrowLeft, Info, BookOpen } from 'lucide-react';

interface ParticipationFlagsPageProps {
  onNavigateBack: () => void;
}

const ParticipationFlagsPage: React.FC<ParticipationFlagsPageProps> = ({ onNavigateBack }) => {
  const flagData = [
    {
      id: 1,
      category: "Unprepared / Missing Materials",
      description: "Arrives without the tools or prior work needed to start the task.",
      examples: "No notebook, left laptop charger at home, didn't read assigned article.",
      research: "Chronic lack of materials is a top barrier to engagement and requires targeted \"pedagogy of preparation.\"",
      source: "PMC"
    },
    {
      id: 2,
      category: "Off-Task / Distracted",
      description: "Attention drifts to non-lesson stimuli; engagement with task pauses.",
      examples: "Side-chat, scrolling social media, staring out the window.",
      research: "Distraction measurably reduces academic engagement; even nearby off-task peers spread inattention.",
      source: "Psychiatry Online, The Effortful Educator"
    },
    {
      id: 3,
      category: "Not Following Directions",
      description: "Ignores, skips, or resists stated instructions or procedures.",
      examples: "Keeps working after \"pencils down,\" skips a lab-safety step, stays silent when told to discuss in pairs.",
      research: "\"Ignoring teacher guidance\" is a core mis-engagement pattern in classroom-management studies.",
      source: "smartclassroommanagement.com"
    },
    {
      id: 4,
      category: "Inauthentic Work",
      description: "Product is not the student's own thinking.",
      examples: "Copy-paste from peer or internet, AI-generated paragraph turned in as original.",
      research: "Teachers report a sharp rise in AI-assisted plagiarism, complicating fair assessment.",
      source: "Business Insider, k12dive.com"
    },
    {
      id: 5,
      category: "Low Effort / Incomplete Work",
      description: "Output is rushed, superficial, or left unfinished.",
      examples: "One-word answers, half-blank worksheet, messy quick sketch.",
      research: "Students default to the \"principle of least effort\" unless tasks explicitly push deeper work.",
      source: "Edutopia"
    },
    {
      id: 6,
      category: "Needs Support to Engage",
      description: "Hesitates or freezes; starts only after prompts or scaffolds.",
      examples: "Sits idle until teacher models first step; asks \"Is this right?\" before writing anything.",
      research: "Anxiety or uncertainty can suppress participation; well-structured active learning reduces these freezes.",
      source: "PMC"
    },
    {
      id: 7,
      category: "Passive Participation",
      description: "Present but silent; no questions, comments, or note-taking.",
      examples: "\"Head-nodder\" during discussion, never raises hand, blank notebook.",
      research: "Passive participants learn less than they perceive compared with active methods.",
      source: "Online Learning Consortium"
    },
    {
      id: 8,
      category: "No Feedback-Seeking / Use",
      description: "Receives comments but doesn't ask clarifying questions or revise work.",
      examples: "Resubmits essay with identical errors; ignores rubric notes.",
      research: "Teaching feedback-seeking behaviours improves self-regulation and achievement.",
      source: "Taylor & Francis Online"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      <div className="container mx-auto px-4 py-6 relative z-10">
        {/* Header */}
        <div className="flex items-center mb-8 space-x-4">
          <button
            onClick={onNavigateBack}
            className="p-3 bg-white rounded-xl hover:bg-gray-50 transition-all border border-gray-200 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 flex items-center">
              <Info className="w-8 h-8 mr-3 text-blue-500" />
              Participation Flags Guide
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm">
              Understanding habits-of-learning flag categories
            </p>
          </div>
        </div>

        {/* Introduction */}
        <div className="bg-white rounded-2xl p-6 mb-8 border border-gray-200 shadow-sm">
          <div className="flex items-center mb-4">
            <BookOpen className="w-5 h-5 mr-2 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900">About These Flags</h2>
          </div>
          <p className="text-gray-700 text-sm leading-relaxed">
            This concise "habits-of-learning" flag set includes 8 categories. Each flag is observable during class, 
            focuses on how students engage with learning, and avoids pure behaviour/discipline items.
          </p>
        </div>

        {/* Flags Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider w-8">
                    #
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    Flag Category
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    What it looks like in class
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    Typical examples
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    Research insight
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {flagData.map((flag, index) => (
                  <tr key={flag.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900 align-top">
                      {flag.id}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-gray-900 align-top">
                      {flag.category}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 align-top leading-relaxed">
                      {flag.description}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 align-top leading-relaxed">
                      {flag.examples}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 align-top leading-relaxed">
                      {flag.research}
                      <div className="mt-2">
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                          {flag.source}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Implementation Guide */}
      </div>
    </div>
  );
};

export default ParticipationFlagsPage;