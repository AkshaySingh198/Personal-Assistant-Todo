import React, { useState } from 'react';
import axios from 'axios';

const Onboarding = ({ onOnboardingComplete, API_URL }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    usualDay: '',
    stuckProblem: '',
    annoyance: ''
  });
  const [error, setError] = useState('');

  const questions = [
    {
      key: 'usualDay',
      title: 'What best describes your usual day?',
      options: [
        'Mostly at a desk',
        'Mix of field and desk',
        'Always on the move',
        'Varies completely'
      ]
    },
    {
      key: 'stuckProblem',
      title: "When you're stuck on a problem, what do you usually do first?",
      options: [
        'Google it',
        'Think it through myself',
        'Ask someone',
        'Just try things until it works'
      ]
    },
    {
      key: 'annoyance',
      title: 'When someone explains something, what annoys you most?',
      options: [
        'Too much detail',
        'Too vague',
        'Skips the why',
        'Talks down to me'
      ]
    }
  ];

  const handleSelectOption = (option) => {
    const currentKey = questions[step].key;
    setAnswers(prev => ({ ...prev, [currentKey]: option }));
  };

  const handleNext = async () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      // Submit answers
      try {
        setError('');
        await axios.post(`${API_URL}/api/auth/onboarding`, answers, { withCredentials: true });
        onOnboardingComplete();
      } catch (err) {
        setError('Failed to save questionnaire. Please try again.');
        console.error(err);
      }
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const currentQuestion = questions[step];
  const selectedOption = answers[currentQuestion.key];

  return (
    <div className="onboarding-container">
      <div className="glass-panel onboarding-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-purple)', textTransform: 'uppercase' }}>
            Setup Survey
          </span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Step {step + 1} of {questions.length}
          </span>
        </div>

        <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', marginBottom: '30px' }}>
          <div 
            style={{ 
              height: '100%', 
              width: `${((step + 1) / questions.length) * 100}%`, 
              background: 'linear-gradient(to right, var(--accent-purple), var(--accent-blue))',
              borderRadius: '2px',
              transition: 'width 0.3s ease'
            }} 
          />
        </div>

        <h3 className="survey-question">{currentQuestion.title}</h3>

        {error && (
          <div style={{ color: 'var(--accent-red)', background: 'var(--accent-red-glow)', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '15px' }}>
            {error}
          </div>
        )}

        <div className="survey-options">
          {currentQuestion.options.map((option, idx) => (
            <button
              key={idx}
              className={`survey-option-btn ${selectedOption === option ? 'selected' : ''}`}
              onClick={() => handleSelectOption(option)}
            >
              {option}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handlePrev}
            disabled={step === 0}
            style={{ opacity: step === 0 ? 0.5 : 1, cursor: step === 0 ? 'not-allowed' : 'pointer' }}
          >
            Back
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleNext}
            disabled={!selectedOption}
            style={{ opacity: !selectedOption ? 0.6 : 1, cursor: !selectedOption ? 'not-allowed' : 'pointer' }}
          >
            {step === questions.length - 1 ? 'Finish Setup' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
