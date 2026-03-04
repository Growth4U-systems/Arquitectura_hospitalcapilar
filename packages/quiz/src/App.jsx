import { Routes, Route, useParams } from 'react-router-dom'
import HospitalCapilarQuiz from './components/HospitalCapilarQuiz'
import QuizRenderer from './components/QuizRenderer'
import QuizPreview from './components/QuizPreview'
import './App.css'

// Dynamic quiz page that reads from Firestore
function DynamicQuizPage() {
  const { slug } = useParams()
  return <QuizRenderer slug={slug} />
}

// Preview page - loads by slug, works for drafts
function PreviewPage() {
  const { slug } = useParams()
  return <QuizPreview slug={slug} />
}

function App() {
  return (
    <Routes>
      {/* Hospital Capilar Quiz */}
      <Route path="/" element={<HospitalCapilarQuiz />} />

      {/* Preview mode - accessible before publishing */}
      <Route path="/preview/:slug" element={<PreviewPage />} />

      {/* Dynamic quizzes loaded from Firestore */}
      <Route path="/q/:slug" element={<DynamicQuizPage />} />
    </Routes>
  )
}

export default App
