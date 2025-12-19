import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';

interface TriviaQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  category: 'artists' | 'songs' | 'albums' | 'history';
  difficulty: 'easy' | 'medium' | 'hard';
}

interface MusicTriviaProps {
  onExit: () => void;
  onXPGained?: (xp: number) => void;
}

// Pre-built question bank (AI can expand this)
const QUESTION_BANK: TriviaQuestion[] = [
  {
    question: "Which artist released the album 'Thriller' in 1982?",
    options: ["Prince", "Michael Jackson", "Stevie Wonder", "Whitney Houston"],
    correctIndex: 1,
    category: 'albums',
    difficulty: 'easy'
  },
  {
    question: "What year was Spotify founded?",
    options: ["2004", "2006", "2008", "2010"],
    correctIndex: 1,
    category: 'history',
    difficulty: 'medium'
  },
  {
    question: "Which band performed 'Bohemian Rhapsody'?",
    options: ["The Beatles", "Led Zeppelin", "Queen", "Pink Floyd"],
    correctIndex: 2,
    category: 'songs',
    difficulty: 'easy'
  },
  {
    question: "Who is known as the 'King of Pop'?",
    options: ["Elvis Presley", "Michael Jackson", "Prince", "James Brown"],
    correctIndex: 1,
    category: 'artists',
    difficulty: 'easy'
  },
  {
    question: "What was the first music video played on MTV?",
    options: ["Thriller", "Video Killed the Radio Star", "Take On Me", "Like a Virgin"],
    correctIndex: 1,
    category: 'history',
    difficulty: 'hard'
  },
  {
    question: "Which artist has the most Grammy Awards ever?",
    options: ["Beyoncé", "Taylor Swift", "Adele", "U2"],
    correctIndex: 0,
    category: 'artists',
    difficulty: 'medium'
  },
  {
    question: "What genre originated in the Bronx, New York in the 1970s?",
    options: ["Disco", "Punk Rock", "Hip Hop", "Grunge"],
    correctIndex: 2,
    category: 'history',
    difficulty: 'medium'
  },
  {
    question: "Which song holds the record for longest time at #1 on Billboard Hot 100?",
    options: ["Shape of You", "Old Town Road", "Despacito", "Uptown Funk"],
    correctIndex: 1,
    category: 'songs',
    difficulty: 'hard'
  },
  {
    question: "What instrument does a bassist play?",
    options: ["Drums", "Bass Guitar", "Keyboard", "Saxophone"],
    correctIndex: 1,
    category: 'history',
    difficulty: 'easy'
  },
  {
    question: "Which streaming platform is owned by Apple?",
    options: ["Spotify", "Tidal", "Apple Music", "Amazon Music"],
    correctIndex: 2,
    category: 'history',
    difficulty: 'easy'
  }
];

const XP_REWARDS = {
  easy: 10,
  medium: 20,
  hard: 30
};

const MusicTrivia: React.FC<MusicTriviaProps> = ({ onExit, onXPGained }) => {
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [streak, setStreak] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'finished'>('playing');
  const [timeLeft, setTimeLeft] = useState(15);

  // Initialize with shuffled questions
  useEffect(() => {
    const shuffled = [...QUESTION_BANK].sort(() => Math.random() - 0.5).slice(0, 5);
    setQuestions(shuffled);
  }, []);

  // Timer
  useEffect(() => {
    if (gameState !== 'playing' || isAnswered || questions.length === 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeout();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, isAnswered, gameState, questions.length]);

  const handleTimeout = () => {
    setIsAnswered(true);
    setStreak(0);
    setTimeout(nextQuestion, 2000);
  };

  const handleAnswer = (index: number) => {
    if (isAnswered) return;
    
    setSelectedAnswer(index);
    setIsAnswered(true);
    
    const currentQuestion = questions[currentIndex];
    const isCorrect = index === currentQuestion.correctIndex;
    
    if (isCorrect) {
      const baseXP = XP_REWARDS[currentQuestion.difficulty];
      const streakBonus = streak >= 3 ? Math.floor(baseXP * 0.5) : 0;
      const totalXP = baseXP + streakBonus;
      
      setScore(prev => prev + 1);
      setXpEarned(prev => prev + totalXP);
      setStreak(prev => prev + 1);
    } else {
      setStreak(0);
    }
    
    setTimeout(nextQuestion, 2000);
  };

  const nextQuestion = () => {
    if (currentIndex >= questions.length - 1) {
      setGameState('finished');
      if (onXPGained) onXPGained(xpEarned);
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setTimeLeft(15);
    }
  };

  const restartGame = () => {
    const shuffled = [...QUESTION_BANK].sort(() => Math.random() - 0.5).slice(0, 5);
    setQuestions(shuffled);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setXpEarned(0);
    setStreak(0);
    setGameState('playing');
    setTimeLeft(15);
  };

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <ICONS.Loader size={32} className="animate-spin" />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onExit} className="p-2 hover:bg-white/10 rounded transition-colors">
          <ICONS.ArrowUp size={20} className="rotate-[-90deg]" />
        </button>
        <h1 className="font-mono font-bold text-xl uppercase flex items-center gap-2">
          🎵 Music Trivia
        </h1>
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded">
          <span className="text-yellow-400">⭐</span>
          <span className="font-mono font-bold">{xpEarned} XP</span>
        </div>
      </div>

      {gameState === 'playing' ? (
        <>
          {/* Progress & Stats */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-mono opacity-70">
                Question {currentIndex + 1}/{questions.length}
              </span>
              {streak >= 3 && (
                <span className="bg-orange-500 text-white px-2 py-0.5 text-xs font-bold rounded animate-pulse">
                  🔥 {streak} STREAK!
                </span>
              )}
            </div>
            <div className={`flex items-center gap-2 ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : ''}`}>
              <ICONS.Timer size={16} />
              <span className="font-mono font-bold">{timeLeft}s</span>
            </div>
          </div>

          {/* Timer Bar */}
          <div className="w-full h-2 bg-white/20 rounded-full mb-6 overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${(timeLeft / 15) * 100}%` }}
            />
          </div>

          {/* Question */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 w-full max-w-xl">
              <span className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded ${
                currentQuestion.difficulty === 'easy' ? 'bg-green-500' :
                currentQuestion.difficulty === 'medium' ? 'bg-yellow-500 text-black' : 'bg-red-500'
              }`}>
                {currentQuestion.difficulty} • {currentQuestion.category}
              </span>
              <h2 className="text-xl font-bold mt-4">{currentQuestion.question}</h2>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
              {currentQuestion.options.map((option, index) => {
                let bgClass = 'bg-white/10 hover:bg-white/20';
                
                if (isAnswered) {
                  if (index === currentQuestion.correctIndex) {
                    bgClass = 'bg-green-500';
                  } else if (index === selectedAnswer && index !== currentQuestion.correctIndex) {
                    bgClass = 'bg-red-500';
                  } else {
                    bgClass = 'bg-white/5 opacity-50';
                  }
                }
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    disabled={isAnswered}
                    className={`${bgClass} p-4 rounded-lg font-medium transition-all text-left ${
                      !isAnswered ? 'cursor-pointer active:scale-95' : ''
                    }`}
                  >
                    <span className="opacity-50 mr-2">{String.fromCharCode(65 + index)}.</span>
                    {option}
                  </button>
                );
              })}
            </div>

            {/* Feedback */}
            {isAnswered && (
              <div className={`mt-6 text-center font-bold text-lg ${
                selectedAnswer === currentQuestion.correctIndex ? 'text-green-400' : 'text-red-400'
              }`}>
                {selectedAnswer === currentQuestion.correctIndex ? (
                  <>✓ Correct! +{XP_REWARDS[currentQuestion.difficulty]} XP</>
                ) : selectedAnswer === null ? (
                  <>⏱ Time's up!</>
                ) : (
                  <>✗ Wrong answer</>
                )}
              </div>
            )}
          </div>

          {/* Score Footer */}
          <div className="flex justify-center gap-8 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{score}</p>
              <p className="text-xs opacity-70">Correct</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{streak}</p>
              <p className="text-xs opacity-70">Streak</p>
            </div>
          </div>
        </>
      ) : (
        /* Game Over Screen */
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-6xl mb-4">
            {score >= 4 ? '🏆' : score >= 2 ? '🎉' : '😅'}
          </div>
          <h2 className="text-3xl font-bold mb-2">Game Over!</h2>
          <p className="text-xl opacity-70 mb-6">
            You got {score} out of {questions.length} correct
          </p>
          
          <div className="bg-white/10 rounded-xl p-6 mb-6 text-center">
            <p className="text-4xl font-bold text-yellow-400">+{xpEarned} XP</p>
            <p className="text-sm opacity-70">Experience Earned</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={restartGame}
              className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-white/90 transition-colors"
            >
              Play Again
            </button>
            <button
              onClick={onExit}
              className="px-6 py-3 bg-white/20 font-bold rounded-lg hover:bg-white/30 transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicTrivia;
