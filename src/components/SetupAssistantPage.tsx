import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Bot, User, Sparkles, BookOpen, Users, Target, HelpCircle, CheckCircle, ArrowRight } from 'lucide-react';

interface SetupAssistantPageProps {
  onNavigateBack: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

const SetupAssistantPage: React.FC<SetupAssistantPageProps> = ({ onNavigateBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    addWelcomeMessage();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addWelcomeMessage = () => {
    const welcomeMessage: Message = {
      id: 'welcome',
      type: 'assistant',
      content: `👋 Hi there! I'm your setup assistant for the Participation Tracker. I'm here to help you get started and answer any questions you have about using the app.

I can help you with:
• Creating your first class
• Adding students to your classes
• Understanding the point system
• Setting up participation tracking
• Generating reports and analytics

What would you like to know about setting up your participation tracker?`,
      timestamp: new Date(),
      suggestions: [
        "How do I create my first class?",
        "How does the point system work?",
        "How do I add students?",
        "How do I track participation during class?",
        "How do I generate reports?"
      ]
    };
    setMessages([welcomeMessage]);
  };

  const getAssistantResponse = (userInput: string): Message => {
    const input = userInput.toLowerCase().trim();

    let response = '';
    let suggestions: string[] = [];

    if (
      input.includes('participation flag') ||
      input.includes('participation flags') ||
      input.includes('behavior alert') ||
      input.includes('alert category') ||
      input.includes('flag')
    ) {
      response = `Participation flags are used to capture learning habits that may need attention. They help teachers document patterns over time and support students more effectively.

The current categories include:
• Not Following Directions  
• Off-Task / Distracted  
• Incomplete or Inauthentic Work  
• Unprepared for Class  
• Low Effort / Rushing  
• Needs Support to Engage

To give a participation flag:
1. Click "Track Participation"
2. Select a student
3. Choose the appropriate flag from the list.`;

      suggestions = [
        "How do I give a participation flag?",
        "How do I see reports?",
        "How do I reset student points?"
      ];
    } else if (input.includes('edit') && input.includes('student')) {
      response = `To edit a student:
1. Go to your class page
2. Click the three dots (⋮) on the student card
3. Select "Edit Student"
4. Update the student's name or photo
5. Click "Update Student"`;

      suggestions = [
        "How do I add students?",
        "How do I delete a student?",
        "How do I reset student points?"
      ];
    } else if (input.includes('edit') && input.includes('class')) {
      response = `To edit a class:
1. From the main dashboard, click the three dots (⋮) on the class card
2. Select "Edit Class"
3. Update the class name
4. Click "Update Class"`;

      suggestions = [
        "How do I delete a class?",
        "How do I add students?",
        "How do I reset all points in a class?"
      ];
    } else if (input.includes('delete') && input.includes('class')) {
      response = `To delete a class:
1. From the main dashboard, click the three dots (⋮) on the class card
2. Select "Delete Class"
3. Confirm the deletion

⚠️ Warning: This will permanently delete the class and all student data in it.`;

      suggestions = [
        "How do I edit a class?",
        "How do I reset all points in a class?",
        "How do I create a class?"
      ];
    } else if (input.includes('student') && (input.includes('add') || input.includes('create') || input.includes('how'))) {
      response = `To add students:
1. Click on your class card from the main dashboard
2. Click the "Add Student" button
3. Enter the student's name
4. Click "Add Student"`;

      suggestions = ["How do I generate reports?"];
    } else if (input.includes('class') && (input.includes('create') || input.includes('add') || input.includes('first'))) {
      response = `To create a class:
1. From the main dashboard, click the "Add Class" button
2. Enter a class name
3. Click "Create Class"`;

      suggestions = [
        "How do I add students?",
        "How do I give points?"
      ];
    } else if (input.includes('point') || input.includes('participation') || input.includes('track')) {
      if (input.includes('reset')) {
        response = `To reset student points:
1. Go to your class page
2. Click the three dots (⋮) on any student card
3. Choose "Reset Points" to clear their points to zero

To reset all points for a class:
1. From the main dashboard, click the three dots (⋮) on any class card
2. Choose "Reset All Points" to clear all student points in that class`;

        suggestions = [
          "How do I give points?",
          "How do I add students?"
        ];
      } else if (input.includes('add') || input.includes('give') || input.includes('award')) {
        response = `To give points to students:
1. Go to your class page
2. Click "Track Participation" 
3. Tap on any student's card
4. Choose positive points: +1, +2, +5, or +10
5. The points are added immediately

To give participation flags:
1. Follow steps 1-3 above
2. Click "Participation Flags" 
3. Select the category (Not Following Directions, Off-Task, etc.)
4. The participation flag is recorded immediately`;

        suggestions = [
          "What are participation flags?",
          "How do I see reports?",
          "How do I reset points?"
        ];
      } else {
        response = `To give points:
1. Go to your class page
2. Click "Track Participation"
3. Tap any student's card
4. Choose + points (1, 2, 5, or 10) or give an alert`;

        suggestions = [
          "What are participation flags?",
          "How do I see reports?"
        ];
      }
    } else if (input.includes('report') || input.includes('analytic') || input.includes('data')) {
      response = `To see reports:
1. From the main dashboard, click "Reports & Analytics"
2. Select your class and time period
3. View the data or export as CSV`;

      suggestions = [
        "How do I give points?",
        "How do I add students?"
      ];
    } else if (input.includes('start') || input.includes('begin') || input.includes('setup')) {
      response = `Quick setup:
1. Create a class (click "Add Class")
2. Add students (click your class, then "Add Student")  
3. Start giving points (click "Track Participation")`;

      suggestions = [
        "How do I create a class?",
        "How do I add students?",
        "How do I give points?"
      ];
    } else if (input.includes('cost') || input.includes('price') || input.includes('trial')) {
      response = `30-day free trial, then $5 per year. No credit card required for trial.`;

      suggestions = [
        "How do I get started?",
        "How do I create a class?"
      ];
    } else {
      response = `I can help you with:
• Creating classes
• Adding students  
• Giving points and participation flags
• Viewing reports

What do you need help with?`;

      suggestions = [
        "How do I create a class?",
        "How do I add students?",
        "How do I give points?",
        "How do I see reports?"
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

    await new Promise(resolve => setTimeout(resolve, 1000));

    const assistantMessage = getAssistantResponse(inputValue);
    setMessages(prev => [...prev, assistantMessage]);
    setLoading(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      <div className="container mx-auto px-4 py-6 relative z-10 max-w-4xl">
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
                <Sparkles className="w-8 h-8 mr-3 text-green-400" />
                Setup Assistant
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm">
                Get help setting up your participation tracker
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm h-[600px] flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    message.type === 'user'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      message.type === 'user' 
                        ? 'bg-white/20' 
                        : 'bg-green-500'
                    }`}>
                      {message.type === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm whitespace-pre-line ${message.type === 'user' ? 'text-white' : 'text-gray-900'}`}>
                        {message.content}
                      </p>
                      {message.suggestions && message.suggestions.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs text-gray-500 mb-2">Related:</p>
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
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 max-w-[80%]">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-200 p-4">
            <div className="flex space-x-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask me how to do something..."
                className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={handleSendMessage}
                disabled={loading || !inputValue.trim()}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupAssistantPage;