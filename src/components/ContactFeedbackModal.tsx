import React, { useState } from 'react';
import { X, MessageSquare, ChevronDown, ChevronUp, Send, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ContactFeedbackModalProps {
  onClose: () => void;
}

interface FormData {
  name: string;
  email: string;
  message: string;
  frequency: string;
  easeOfUse: number;
  usefulness: number;
  accuracy: number;
  recommend: string;
  additionalComments: string;
}

const ContactFeedbackModal: React.FC<ContactFeedbackModalProps> = ({ onClose }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    message: '',
    frequency: '',
    easeOfUse: 0,
    usefulness: 0,
    accuracy: 0,
    recommend: '',
    additionalComments: ''
  });
  
  const [showSurvey, setShowSurvey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Call Supabase Edge Function directly to avoid WebContainer issues
      const response = await fetch('https://symwtbndqsrirciaaxpd.functions.supabase.co/send-feedback-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
          survey: showSurvey ? {
            frequency: formData.frequency,
            easeOfUse: formData.easeOfUse,
            usefulness: formData.usefulness,
            accuracy: formData.accuracy,
            recommend: formData.recommend,
            additionalComments: formData.additionalComments
          } : null
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send feedback: ${errorText}`);
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error sending feedback:', err);
      setError('Failed to send feedback. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const renderStarRating = (field: 'easeOfUse' | 'usefulness' | 'accuracy', label: string) => {
    const value = formData[field];
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">1</span>
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => handleInputChange(field, rating)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                value >= rating
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 hover:border-green-400'
              }`}
            >
              {rating}
            </button>
          ))}
          <span className="text-xs text-gray-500">5</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {field === 'easeOfUse' && '1 = Very difficult → 5 = Very easy'}
          {field === 'usefulness' && '1 = Not useful → 5 = Very useful'}
          {field === 'accuracy' && '1 = Not accurate → 5 = Very accurate'}
        </div>
      </div>
    );
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-600">Thank you for reaching out! We'll be in touch soon.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 shadow-xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Contact & Feedback</h2>
                <p className="text-gray-600 text-sm">We'd love to hear from you</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Information */}
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm text-gray-900"
                  placeholder="Your full name"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm text-gray-900"
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm text-gray-900 resize-none"
                  placeholder="Tell us what's on your mind..."
                  rows={4}
                />
              </div>
            </div>

            {/* Optional Survey Section */}
            <div className="border-t border-gray-200 pt-6">
              <button
                type="button"
                onClick={() => setShowSurvey(!showSurvey)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all border border-gray-200"
              >
                <span className="text-sm font-medium text-gray-700">
                  Optional Feedback Survey
                </span>
                {showSurvey ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {showSurvey && (
                <div className="mt-4 space-y-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {/* Frequency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      How often do you use the app?
                    </label>
                    <div className="space-y-2">
                      {['Daily', 'Weekly', 'Monthly', 'Rarely', "Haven't used yet"].map((option) => (
                        <label key={option} className="flex items-center">
                          <input
                            type="radio"
                            name="frequency"
                            value={option}
                            checked={formData.frequency === option}
                            onChange={(e) => handleInputChange('frequency', e.target.value)}
                            className="mr-2 text-blue-500 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Rating Questions */}
                  {renderStarRating('easeOfUse', 'How easy is it to use?')}
                  {renderStarRating('usefulness', 'How useful is it?')}
                  {renderStarRating('accuracy', 'How accurate is the data?')}

                  {/* Recommendation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Would you recommend this app to another teacher?
                    </label>
                    <div className="space-y-2">
                      {['Yes', 'No'].map((option) => (
                        <label key={option} className="flex items-center">
                          <input
                            type="radio"
                            name="recommend"
                            value={option}
                            checked={formData.recommend === option}
                            onChange={(e) => handleInputChange('recommend', e.target.value)}
                            className="mr-2 text-blue-500 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Additional Comments */}
                  <div>
                    <label htmlFor="additionalComments" className="block text-sm font-medium text-gray-700 mb-2">
                      Any other comments?
                    </label>
                    <textarea
                      id="additionalComments"
                      value={formData.additionalComments}
                      onChange={(e) => handleInputChange('additionalComments', e.target.value)}
                      className="w-full px-3 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm text-gray-900 resize-none"
                      placeholder="Share any additional thoughts or suggestions..."
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium transition-all text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactFeedbackModal;