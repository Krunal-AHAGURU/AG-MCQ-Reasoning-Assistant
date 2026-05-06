import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import html2pdf from 'html2pdf.js';
import { 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  BookOpen, 
  Play, 
  ArrowLeft, 
  Eye,
  BrainCircuit,
  Download,
  FileText,
  ExternalLink,
  X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import questionsData from './data/questions.json';

interface OptionExplanation {
  correctFlag: boolean;
  explanation: string;
  why_right: string;
  core_concept: string;
  next_step: string;
}

interface Question {
  id: number;
  question_text: string;
  solution_text: string;
  solution_image_urls: string[];
  solution_images_base64: string[];
  correct_answer: string;
  no_of_options: number;
  "Explnation ( JSON )": Record<string, OptionExplanation>;
}

type Screen = 'START' | 'SELECTION' | 'QUIZ' | 'RESULTS';

export default function App() {
  const [importedQuestions, setImportedQuestions] = useState<Question[] | null>(null);
  const allQuestions = importedQuestions || (questionsData as Question[]);
  const [screen, setScreen] = useState<Screen>('START');
  const [selectedCount, setSelectedCount] = useState<number>(10);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(string | null)[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [reviewingQuestion, setReviewingQuestion] = useState<Question | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const pdfRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle JSON file import
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        // Validate it's an array of questions
        if (Array.isArray(json) && json.length > 0) {
          setImportedQuestions(json as Question[]);
          alert('✅ Questions imported successfully! Now you can start the quiz with the new data.');
          setShowSetupGuide(false);
        } else {
          alert('❌ Invalid format. Please ensure the JSON is an array of questions.');
        }
      } catch (error) {
        alert('❌ Error parsing JSON file. Please check the format.');
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  const exportToPDF = () => {
    if (!pdfRef.current) return;
    
    const element = pdfRef.current;
    const opt = {
      margin: 10,
      filename: `AhaGuru_Session_Report_${new Date().toLocaleDateString()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        logging: false,
        backgroundColor: '#f8fbff'
      },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  // Helper to normalize LaTeX delimiters for ReactMarkdown + remarkMath
  const formatContent = useMemo(() => (text: string) => {
    if (!text) return "";
    // Replace \( \) with $ and \[ \] with $$
    // Handle double-escaped backslashes from JSON parsing
    return text
      .replace(/\\\\\\\\\(/g, '$')
      .replace(/\\\\\\\\\)/g, '$')
      .replace(/\\\\\\/g, '\\') // Fix triple backslashes
      .replace(/\\\(|\\\)/g, '$')
      .replace(/\\\[|\\\]/g, '$$');
  }, []);

  const startQuiz = (count: number) => {
    // Shuffle and select questions
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    setQuizQuestions(shuffled.slice(0, count));
    setSelectedCount(count);
    setCurrentQuestionIndex(0);
    setUserAnswers(new Array(count).fill(null));
    setShowFeedback(false);
    setScreen('QUIZ');
  };

  const handleAnswerSelect = (optionKey: string) => {
    if (showFeedback) return;

    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = optionKey;
    setUserAnswers(newAnswers);

    const isCorrect = optionKey === quizQuestions[currentQuestionIndex].correct_answer;
    
    if (!isCorrect) {
      setShowFeedback(true);
    }
  };

  const skipQuestion = () => {
    setShowFeedback(false);
    if (currentQuestionIndex < selectedCount - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setScreen('RESULTS');
    }
  };

  const nextQuestion = () => {
    setShowFeedback(false);
    if (currentQuestionIndex < selectedCount - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setScreen('RESULTS');
    }
  };

  const calculateScore = () => {
    return userAnswers.reduce((acc, ans, idx) => {
      return ans === quizQuestions[idx]?.correct_answer ? acc + 1 : acc;
    }, 0);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Header */}
      <header className="h-20 bg-white border-b-2 border-border flex items-center justify-between px-8 shrink-0 z-10 w-full">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/20">AG</div>
          <div>
            <h1 className="text-xl font-bold text-primary leading-none">AhaGuru</h1>
            <p className="text-[10px] text-text-light font-medium uppercase tracking-widest mt-1">MCQ Reasoning Assistant</p>
          </div>
        </div>
        
        {screen === 'QUIZ' && (
          <div className="flex items-center gap-4 bg-off-white px-5 py-2 rounded-full border border-border">
            <div className="w-32 h-1.5 bg-border rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestionIndex) / selectedCount) * 100}%` }}
                className="h-full bg-primary"
              />
            </div>
            <span className="text-sm font-bold text-primary shrink-0">
              {currentQuestionIndex + 1} / {selectedCount}
            </span>
          </div>
        )}
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 min-h-0 relative">
        <AnimatePresence mode="wait">
          {screen === 'START' && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-3xl text-center"
            >
              <div className="w-44 h-44 bg-blue-50 rounded-full flex items-center justify-center mb-8 mx-auto text-7xl animate-pulse ring-8 ring-blue-50/50">
                🎯
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-primary mb-4 tracking-tight">
                AG MCQ Reasoning Assistant
              </h1>
              <p className="text-slate-500 mb-10 text-lg leading-relaxed max-w-2xl mx-auto">
                Master mathematics through intelligent practice. Select your answers, 
                receive detailed explanations for every choice, and understand the 
                <strong> why</strong> behind each solution.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {[
                  { icon: '📚', title: '40 Curated Questions', desc: 'Hand-picked MCQs covering key mathematical concepts' },
                  { icon: '💡', title: 'Deep Explanations', desc: 'Understand why each option is right or wrong' },
                  { icon: '📊', title: 'Progress Tracking', desc: 'Review your answers and learn from mistakes' }
                ].map((feature, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border-2 border-border transition-all hover:border-primary hover:shadow-xl group">
                    <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{feature.icon}</div>
                    <h3 className="font-bold text-text-dark text-sm mb-2">{feature.title}</h3>
                    <p className="text-xs text-text-light leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>

              <button
                id="start-button"
                onClick={() => setScreen('SELECTION')}
                className="group flex items-center gap-3 bg-primary text-white px-12 py-5 rounded-2xl font-bold text-lg transition-all hover:bg-primary-dark hover:scale-[1.02] shadow-xl shadow-primary/30 active:scale-95 mx-auto"
              >
                Start Practicing
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}

          {screen === 'SELECTION' && (
            <motion.div
              key="selection"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full max-w-xl text-center"
            >
              <h2 className="text-3xl font-black text-text-dark mb-4">How Many Questions?</h2>
              <p className="text-text-medium mb-10 text-lg">Choose how many questions you'd like to practice in this session.</p>
              
              <div className="grid grid-cols-4 md:grid-cols-5 gap-3 mb-8">
                {[5, 10, 15, 20, 25, 30, 35, 40].map((count) => (
                  <button
                    key={count}
                    id={`select-${count}`}
                    onClick={() => setSelectedCount(count)}
                    className={`p-4 border-2 rounded-xl text-lg font-bold transition-all active:scale-90 ${
                      selectedCount === count 
                        ? "border-primary bg-primary text-white shadow-lg shadow-primary/30" 
                        : "border-border bg-white text-text-medium hover:border-primary-light hover:text-primary"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-text-medium">Or enter custom:</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="40"
                    value={selectedCount}
                    onChange={(e) => setSelectedCount(parseInt(e.target.value) || 1)}
                    className="w-20 px-3 py-2 border-2 border-border rounded-xl text-center font-bold text-primary focus:border-primary outline-none"
                  />
                </div>
                
                <button
                  onClick={() => startQuiz(selectedCount)}
                  className="bg-primary text-white px-12 py-5 rounded-2xl font-bold text-lg transition-all hover:bg-primary-dark hover:scale-[1.02] shadow-xl shadow-primary/30 active:scale-95"
                >
                  Begin Quiz →
                </button>
              </div>
            </motion.div>
          )}

          {screen === 'QUIZ' && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-5xl flex flex-col gap-6"
            >
              <div className="bg-white rounded-[20px] p-8 md:p-10 card-shadow border border-border">
                <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-off-white">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2">
                       Question {currentQuestionIndex + 1}
                       <span className="opacity-50 text-[10px] font-medium tracking-tight">ID: {quizQuestions[currentQuestionIndex].id}</span>
                    </span>
                    <span className="px-3 py-1 bg-warning/10 text-warning rounded-lg text-[10px] font-bold uppercase tracking-widest">Mathematics</span>
                  </div>
                  <div className="text-xs font-bold text-text-light uppercase tracking-widest">AhaGuru reasoning</div>
                </div>

                <div className="markdown-content text-xl md:text-2xl leading-relaxed text-text-dark mb-10 font-medium">
                  <ReactMarkdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                  >
                    {formatContent(quizQuestions[currentQuestionIndex].question_text)}
                  </ReactMarkdown>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                  {Object.keys(quizQuestions[currentQuestionIndex]["Explnation ( JSON )"]).sort().map((optionKey) => {
                    const isSelected = userAnswers[currentQuestionIndex] === optionKey;
                    const isCorrect = optionKey === quizQuestions[currentQuestionIndex].correct_answer;
                    const hasResponded = userAnswers[currentQuestionIndex] !== null;
                    
                    let statusClass = "bg-off-white border-border hover:border-primary-light hover:bg-blue-50/30";
                    let letterClass = "bg-white border-border text-primary";

                    if (isSelected) {
                      if (isCorrect) {
                        statusClass = "bg-success-light border-success";
                        letterClass = "bg-success text-white border-success";
                      } else {
                        statusClass = "bg-error-light border-error";
                        letterClass = "bg-error text-white border-error";
                      }
                    } else if (hasResponded && isCorrect) {
                      statusClass = "bg-success-light/50 border-success/30";
                      letterClass = "bg-success/50 text-white border-success/30";
                    }

                    return (
                      <button
                        key={optionKey}
                        id={`option-${optionKey}`}
                        onClick={() => handleAnswerSelect(optionKey)}
                        disabled={hasResponded}
                        className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left group ${statusClass} ${!hasResponded && "cursor-pointer hover:translate-x-1"}`}
                      >
                        <span className={`w-10 h-10 min-w-10 flex items-center justify-center rounded-xl border-2 font-bold text-lg transition-all ${letterClass}`}>
                          {optionKey}
                        </span>
                        <span className="text-base font-medium">Option {optionKey}</span>
                      </button>
                    );
                  })}
                </div>

                {userAnswers[currentQuestionIndex] !== null && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-t-2 border-border pt-10"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl shadow-inner shadow-primary/5">
                          🧑‍🏫
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-text-dark">Insights</h3>
                          <p className="text-xs text-text-light font-medium uppercase tracking-widest">let's Walkthrough</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${
                          userAnswers[currentQuestionIndex] === quizQuestions[currentQuestionIndex].correct_answer 
                            ? "bg-success text-white shadow-lg shadow-success/20" 
                            : "bg-error text-white shadow-lg shadow-error/20"
                        }`}>
                          {userAnswers[currentQuestionIndex] === quizQuestions[currentQuestionIndex].correct_answer ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {userAnswers[currentQuestionIndex] === quizQuestions[currentQuestionIndex].correct_answer ? "Correct Logic" : "Improve Your Approach"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {userAnswers[currentQuestionIndex] !== quizQuestions[currentQuestionIndex].correct_answer && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                          <div className="bg-error-light/40 border border-error/10 p-8 rounded-[24px] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-error/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                            <h4 className="text-[10px] font-black text-error uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                              Your Reasoning ({userAnswers[currentQuestionIndex]})
                            </h4>
                            <div className="text-base text-text-medium leading-relaxed markdown-content relative z-10">
                              <ReactMarkdown 
                                remarkPlugins={[remarkMath]} 
                                rehypePlugins={[rehypeKatex]}
                              >
                                {formatContent(quizQuestions[currentQuestionIndex]["Explnation ( JSON )"][userAnswers[currentQuestionIndex] as string]?.explanation)}
                              </ReactMarkdown>
                            </div>
                          </div>
                          
                          <div className="bg-blue-50/50 border border-primary/10 p-8 rounded-[24px] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Why It Might Have Seemed Right</h4>
                            <p className="text-base text-text-medium leading-relaxed relative z-10 font-medium italic">
                              "{quizQuestions[currentQuestionIndex]["Explnation ( JSON )"][userAnswers[currentQuestionIndex] as string]?.why_right}"
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="bg-success-light/30 border border-success/10 p-10 rounded-[32px] relative overflow-hidden">
                        <div className="absolute top-8 right-8 text-8xl text-success/5 pointer-events-none">✓</div>
                        <h4 className="text-[10px] font-black text-success uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                          Master Solution ({quizQuestions[currentQuestionIndex].correct_answer})
                        </h4>
                        <div className="text-lg md:text-xl text-text-dark leading-relaxed markdown-content relative z-10 font-medium">
                          <ReactMarkdown 
                            remarkPlugins={[remarkMath]} 
                            rehypePlugins={[rehypeKatex]}
                          >
                            {formatContent(quizQuestions[currentQuestionIndex]["Explnation ( JSON )"][quizQuestions[currentQuestionIndex].correct_answer]?.explanation)}
                          </ReactMarkdown>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-primary/5 border border-primary/10 p-8 rounded-[24px]">
                          <div className="flex items-center gap-3 mb-4">
                            <Eye className="w-5 h-5 text-primary" />
                            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Core Concept</h4>
                          </div>
                          <p className="text-base text-text-medium leading-relaxed font-semibold text-primary/80">
                            {quizQuestions[currentQuestionIndex]["Explnation ( JSON )"][userAnswers[currentQuestionIndex] as string]?.core_concept || quizQuestions[currentQuestionIndex]["Explnation ( JSON )"][quizQuestions[currentQuestionIndex].correct_answer]?.core_concept}
                          </p>
                        </div>
                        <div className="bg-off-white border border-border p-8 rounded-[24px]">
                          <div className="flex items-center gap-3 mb-4">
                            <BrainCircuit className="w-5 h-5 text-text-medium" />
                            <h4 className="text-[10px] font-black text-text-medium uppercase tracking-[0.2em]">Next Practice Step</h4>
                          </div>
                          <p className="text-base text-text-medium leading-relaxed">
                            {quizQuestions[currentQuestionIndex]["Explnation ( JSON )"][userAnswers[currentQuestionIndex] as string]?.next_step || quizQuestions[currentQuestionIndex]["Explnation ( JSON )"][quizQuestions[currentQuestionIndex].correct_answer]?.next_step}
                          </p>
                        </div>
                      </div>
                    </div>

                    {quizQuestions[currentQuestionIndex].solution_image_urls && quizQuestions[currentQuestionIndex].solution_image_urls.length > 0 && (
                      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {quizQuestions[currentQuestionIndex].solution_image_urls.map((url, i) => (
                           <div key={i} className="bg-white border-2 border-border p-2 rounded-2xl shadow-sm">
                             <img src={url} alt="Solution" className="w-full rounded-xl" />
                           </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                <div className="flex justify-between items-center mt-10 pt-6 border-t-2 border-off-white">
                  <button 
                    onClick={skipQuestion}
                    className="px-8 py-3.5 border-2 border-border text-text-medium rounded-xl font-bold hover:border-primary hover:text-primary transition-all flex items-center gap-2"
                  >
                    Skip Question →
                  </button>
                  {userAnswers[currentQuestionIndex] && (
                    <button 
                      onClick={nextQuestion}
                      className="px-10 py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all flex items-center gap-2 transform hover:scale-[1.02] active:scale-95"
                    >
                      {currentQuestionIndex === selectedCount - 1 ? "Finish Quiz 🎉" : "Next Question →"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {screen === 'RESULTS' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-4xl"
            >
              <div ref={pdfRef} className="w-full">
                <div className="text-center mb-10">
                  <h2 className="text-4xl font-black text-primary mb-2">🎉 Quiz Complete!</h2>
                  <p className="text-text-medium text-lg">Detailed performance breakdown and logic review</p>
                </div>

                <div className="bg-white rounded-[20px] p-10 card-shadow border-2 border-border text-center mb-10">
                  <div className="w-44 h-44 rounded-full bg-off-white border-4 border-primary flex flex-col items-center justify-center mx-auto mb-8 shadow-inner shadow-primary/10">
                    <span className="text-5xl font-black text-primary">
                      {Math.round((calculateScore() / selectedCount) * 100)}%
                    </span>
                    <span className="text-xs font-bold text-text-light uppercase tracking-widest mt-1">Accuracy</span>
                  </div>

                  <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
                    <div className="bg-success-light/20 p-6 rounded-2xl border border-success-light">
                      <div className="text-4xl font-black text-success mb-1">{calculateScore()}</div>
                      <div className="text-xs font-bold text-text-light uppercase tracking-widest">Correct</div>
                    </div>
                    <div className="bg-error-light/20 p-6 rounded-2xl border border-error-light">
                      <div className="text-4xl font-black text-error mb-1">{selectedCount - calculateScore()}</div>
                      <div className="text-xs font-bold text-text-light uppercase tracking-widest">Incorrect</div>
                    </div>
                    <div className="bg-blue-50/50 p-6 rounded-2xl border border-border">
                      <div className="text-4xl font-black text-primary mb-1">{selectedCount}</div>
                      <div className="text-xs font-bold text-text-light uppercase tracking-widest">Total</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 md:grid-cols-10 gap-3 mb-10">
                  {quizQuestions.map((q, idx) => {
                    const ans = userAnswers[idx];
                    const isCorrect = ans === q.correct_answer;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setReviewingQuestion(q)}
                        className={`aspect-square rounded-xl border-2 flex items-center justify-center font-bold transition-all hover:-translate-y-1 ${
                          !ans 
                            ? "bg-warning/10 border-warning text-warning" 
                            : isCorrect 
                              ? "bg-success-light border-success text-success" 
                              : "bg-error-light border-error text-error"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="bg-white rounded-[20px] p-8 card-shadow border-2 border-border mb-10">
                  <h3 className="text-xl font-bold text-text-dark mb-4 flex items-center gap-3">
                    <span className="text-2xl">📚</span> Student Study Review
                  </h3>
                  <p className="text-sm text-text-medium mb-8 leading-relaxed">
                    Review your attempts below. Click any question to explore the deep logic behind every choice.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {quizQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => setReviewingQuestion(q)}
                        className="flex items-center justify-between p-4 bg-white border-2 border-primary rounded-xl text-primary font-bold text-sm hover:bg-primary hover:text-white transition-all group"
                      >
                        <span className="flex items-center gap-2">
                          <span className="opacity-60">Q{idx + 1}</span>
                          <span>{userAnswers[idx] === q.correct_answer ? "✓" : userAnswers[idx] ? "✗" : "○"}</span>
                        </span>
                        <span className="text-[10px] uppercase tracking-widest">View Detailed Logic</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-center gap-4 pb-12">
                {/* <button
                  onClick={exportToPDF}
                  className="w-full md:w-auto bg-off-white border-2 border-primary text-primary px-8 py-4 rounded-2xl font-bold text-base transition-all hover:bg-primary hover:text-white flex items-center gap-3 shadow-lg active:scale-95"
                >
                  <Download className="w-5 h-5" />
                  Save Report as PDF
                </button> */}
                <button
                  onClick={() => setScreen('START')}
                  className="w-full md:w-auto bg-primary text-white px-12 py-5 rounded-2xl font-bold text-lg transition-all hover:bg-primary-dark hover:scale-[1.02] shadow-xl shadow-primary/30 active:scale-95 flex items-center gap-3"
                >
                  <RotateCcw className="w-6 h-6" />
                  Start New Session
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {reviewingQuestion && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-text-dark/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-10"
              onClick={() => setReviewingQuestion(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-off-white w-full max-w-5xl rounded-[32px] overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col border border-border"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 md:p-10 border-b bg-white flex justify-between items-center">
                   <div className="flex items-center gap-4">
                     <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                       <FileText className="w-8 h-8" />
                     </div>
                     <div>
                       <h3 className="text-2xl font-black text-text-dark">Question Breakdown</h3>
                       <p className="text-sm font-bold text-text-light uppercase tracking-[0.1em]">Deep Logic & Concept Map</p>
                     </div>
                   </div>
                   <button 
                    onClick={() => setReviewingQuestion(null)}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-off-white hover:bg-error-light hover:text-error transition-all text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>
                
                <div className="p-6 md:p-12 overflow-y-auto custom-scrollbar space-y-12">
                  {/* Question Content */}
                  <div className="bg-white p-8 rounded-[24px] card-shadow border border-border">
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-6 block">The Challenge</span>
                    <div className="markdown-content text-xl md:text-2xl leading-relaxed text-text-dark font-medium">
                      <ReactMarkdown 
                        remarkPlugins={[remarkMath]} 
                        rehypePlugins={[rehypeKatex]}
                      >
                        {formatContent(reviewingQuestion.question_text)}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* All 4 Options Logic */}
                  <div className="space-y-6">
                    <h4 className="text-base font-black text-text-dark uppercase tracking-[0.1em] flex items-center gap-3">
                      <BrainCircuit className="w-5 h-5 text-primary" />
                      Every Option's Logical Context
                    </h4>
                    
                    <div className="grid grid-cols-1 gap-6">
                      {Object.keys(reviewingQuestion["Explnation ( JSON )"]).sort().map((key) => {
                        const isCorrect = key === reviewingQuestion.correct_answer;
                        const optionData = reviewingQuestion["Explnation ( JSON )"][key];
                        
                        return (
                          <div 
                            key={key} 
                            className={`p-8 rounded-[24px] border-2 transition-all ${
                              isCorrect 
                                ? "bg-success-light/20 border-success shadow-md" 
                                : "bg-white border-border hover:border-text-light/30"
                            }`}
                          >
                            <div className="flex items-start gap-6">
                              <span className={`w-12 h-12 min-w-[3rem] flex items-center justify-center rounded-2xl font-bold text-xl ${
                                isCorrect ? "bg-success text-white" : "bg-off-white text-text-dark border border-border"
                              }`}>
                                {key}
                              </span>
                              
                              <div className="flex-1 space-y-6">
                                <div>
                                  <div className="flex items-center gap-3 mb-3">
                                    <h5 className={`font-bold text-lg ${isCorrect ? "text-success" : "text-text-dark"}`}>
                                      {isCorrect ? "Correct Solution" : "Distractor Analysis"}
                                    </h5>
                                    {isCorrect && <span className="bg-success text-white text-[10px] px-2 py-0.5 rounded-full font-black uppercase">Verified</span>}
                                  </div>
                                  <div className="text-base leading-relaxed text-text-medium markdown-content">
                                    <ReactMarkdown 
                                      remarkPlugins={[remarkMath]} 
                                      rehypePlugins={[rehypeKatex]}
                                    >
                                      {formatContent(optionData.explanation)}
                                    </ReactMarkdown>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-dashed border-border">
                                  <div>
                                    <span className="text-[10px] font-black text-text-light uppercase tracking-widest block mb-2">Core Concept</span>
                                    <p className="text-sm font-semibold text-text-dark italic">"{optionData.core_concept}"</p>
                                  </div>
                                  {!isCorrect && (
                                    <div>
                                      <span className="text-[10px] font-black text-error uppercase tracking-widest block mb-2">Why It Might Have Seemed Right</span>
                                      <p className="text-sm text-text-medium">"{optionData.why_right}"</p>
                                    </div>
                                  )}
                                  {isCorrect && (
                                    <div>
                                      <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">Next Mastery Step</span>
                                      <p className="text-sm text-text-medium">"{optionData.next_step}"</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Visual Aid */}
                  {reviewingQuestion.solution_image_urls && reviewingQuestion.solution_image_urls.length > 0 && (
                    <div className="bg-white p-8 rounded-[24px] border-2 border-dashed border-border">
                       <h4 className="text-[10px] font-black text-text-light uppercase tracking-[0.2em] mb-6">Visual Proof & Diagrams</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {reviewingQuestion.solution_image_urls.map((url, i) => (
                           <div key={i} className="bg-off-white p-4 rounded-2xl border border-border shadow-inner">
                             <img src={url} alt="Logic Visual" className="w-full h-auto rounded-xl" />
                           </div>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-4 right-4 z-50">
        <div className="flex items-center gap-2">
          {/* Setup Guide Button */}
          <button
            onClick={() => {
              setShowSetupGuide(true);
              setCurrentStep(1);
            }}
            className="px-4 py-2 bg-gradient-to-r from-[#3071b7] to-[#4a8fd6] text-white rounded-lg font-semibold text-sm flex items-center gap-2 hover:shadow-lg transition-all hover:scale-105"
            title="Setup & Import Questions"
          >
            <FileText size={16} />
            Setup Guide
          </button>

          {/* Crafted By Badge */}
          <div className="px-5 py-2.5 bg-white/90 backdrop-blur-md rounded-full border border-slate-200 shadow-lg flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#3071b7] animate-pulse shadow-sm shadow-[#3071b7]/50" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Crafted by Team Analytics</span>
          </div>
        </div>
      </footer>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Setup Guide Modal */}
      <AnimatePresence>
        {showSetupGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSetupGuide(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-[#3071b7] to-[#4a8fd6] text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrainCircuit size={24} />
                  <h2 className="text-xl font-bold">Setup Guide - Import Questions</h2>
                </div>
                <button
                  onClick={() => setShowSetupGuide(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8">
                {/* Steps Navigation */}
                <div className="flex justify-between mb-8">
                  {[1, 2, 3].map((step) => (
                    <motion.button
                      key={step}
                      onClick={() => setCurrentStep(step)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`flex-1 mx-2 py-3 rounded-lg font-semibold transition-all ${
                        currentStep === step
                          ? 'bg-gradient-to-r from-[#3071b7] to-[#4a8fd6] text-white shadow-lg'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      Step {step}
                    </motion.button>
                  ))}
                </div>

                {/* Step Content */}
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="min-h-[400px]"
                >
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-2xl font-bold text-[#3071b7] mb-6">Step 1: Generate Questions Using Prompt</h3>
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                        <p className="text-slate-700 mb-4">
                          Use the following prompt template with an AI model (like Claude, ChatGPT, etc.) to generate MCQ questions with detailed explanations.
                        </p>
                        <div className="bg-white border border-slate-300 rounded-lg p-4 mb-4">
                          <pre className="text-xs overflow-x-auto text-slate-700 font-mono whitespace-pre-wrap break-words max-h-64">
{`You are an expert teacher with 15+ years of experience teaching students from Class 8 to JEE & NEET level across subjects.

Your teaching style:
- Clear, conceptual, and student-friendly
- Focused on WHY an option is correct or wrong
- No unnecessary theory
- Language suitable for CBSE level

For each MCQ, provide explanations for all options in this JSON format:
{
  "id": 1,
  "question_text": "...",
  "correct_answer": "A",
  "no_of_options": 4,
  "Explnation ( JSON )": {
    "A": {
      "correctFlag": true/false,
      "explanation": "short reason",
      "why_right": "why student might pick this",
      "core_concept": "key idea",
      "next_step": "how to avoid mistake"
    }
  }
}`}
                          </pre>
                        </div>
                        <p className="text-slate-600 text-sm italic">Copy this prompt and use it with your preferred AI tool.</p>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-2xl font-bold text-[#3071b7] mb-6">Step 2: Generate Questions in Colab</h3>
                      <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6">
                        <p className="text-slate-700 mb-4">
                          Open the Google Colab notebook to generate questions in bulk using the Gemini AI API. This notebook will generate properly formatted JSON output.
                        </p>
                        <a
                          href="https://colab.research.google.com/drive/1DmPO3zhLfCM4n49DT29XML8xVCj6lCyH?usp=sharing"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all mb-4"
                        >
                          <ExternalLink size={18} />
                          Open Google Colab Notebook
                        </a>
                        <div className="bg-white border border-slate-300 rounded-lg p-4">
                          <p className="font-semibold text-slate-700 mb-2">Steps in Colab:</p>
                          <ol className="list-decimal list-inside space-y-2 text-slate-600 text-sm">
                            <li>Enter your questions or topics</li>
                            <li>Configure the Gemini API key</li>
                            <li>Run the notebook to generate formatted JSON</li>
                            <li>Download the JSON output file</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-2xl font-bold text-[#3071b7] mb-6">Step 3: Import JSON & Start Quiz</h3>
                      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                        <p className="text-slate-700 mb-6">
                          Import the JSON file generated from Step 1 or Step 2. Once imported, you can use it for the quiz immediately.
                        </p>

                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all mb-6 flex items-center justify-center gap-2"
                        >
                          <FileText size={20} />
                          Click Here to Import JSON File
                        </button>

                        <div className="bg-white border border-slate-300 rounded-lg p-4 mb-4">
                          <p className="font-semibold text-slate-700 mb-2">📋 Expected JSON Format:</p>
                          <pre className="text-xs overflow-x-auto text-slate-700 font-mono whitespace-pre-wrap break-words max-h-48">
{`[
  {
    "id": 1,
    "question_text": "What is...",
    "solution_text": "The answer is...",
    "correct_answer": "A",
    "no_of_options": 4,
    "solution_image_urls": [],
    "solution_images_base64": [],
    "Explnation ( JSON )": {
      "A": { "correctFlag": true, ... },
      "B": { "correctFlag": false, ... }
    }
  }
]`}
                          </pre>
                        </div>

                        {importedQuestions && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-green-100 border border-green-500 rounded-lg p-4"
                          >
                            <p className="text-green-700 font-semibold">
                              ✅ {importedQuestions.length} questions loaded! Ready to start the quiz.
                            </p>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
                <button
                  onClick={() => setShowSetupGuide(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-all"
                >
                  Close
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
                    disabled={currentStep === 1}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => currentStep < 3 && setCurrentStep(currentStep + 1)}
                    disabled={currentStep === 3}
                    className="px-4 py-2 bg-[#3071b7] text-white rounded-lg font-semibold hover:bg-[#1e5a96] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
