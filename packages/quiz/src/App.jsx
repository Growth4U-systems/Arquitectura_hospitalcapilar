import { Routes, Route, useParams } from 'react-router-dom'
import HospitalCapilarQuiz from './components/HospitalCapilarQuiz'
import QuizRenderer from './components/QuizRenderer'
import QuizPreview from './components/QuizPreview'
import BookingCalendar from './components/BookingCalendar'
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
      {/* Hospital Capilar Quiz — generic */}
      <Route path="/" element={<HospitalCapilarQuiz />} />

      {/* Niche quiz — 7 nichos */}
      <Route path="/el-espejo" element={<HospitalCapilarQuiz nicho="el-espejo" />} />
      <Route path="/es-normal" element={<HospitalCapilarQuiz nicho="es-normal" />} />
      <Route path="/postparto" element={<HospitalCapilarQuiz nicho="postparto" />} />
      <Route path="/que-me-pasa" element={<HospitalCapilarQuiz nicho="que-me-pasa" />} />
      <Route path="/ya-me-engañaron" element={<HospitalCapilarQuiz nicho="ya-me-engañaron" />} />
      <Route path="/farmacia-sin-salida" element={<HospitalCapilarQuiz nicho="farmacia-sin-salida" />} />
      <Route path="/la-inversion" element={<HospitalCapilarQuiz nicho="la-inversion" />} />

      {/* Legacy redirects — old slugs → new slugs */}
      <Route path="/jovenes" element={<HospitalCapilarQuiz nicho="el-espejo" />} />
      <Route path="/mujeres" element={<HospitalCapilarQuiz nicho="es-normal" />} />
      <Route path="/segunda-opinion" element={<HospitalCapilarQuiz nicho="ya-me-engañaron" />} />
      <Route path="/post-trasplante" element={<HospitalCapilarQuiz nicho="la-inversion" />} />
      <Route path="/hombres-caida" element={<HospitalCapilarQuiz nicho="que-me-pasa" />} />

      {/* Preview mode */}
      <Route path="/preview/:slug" element={<PreviewPage />} />

      {/* Dynamic quizzes from Firestore */}
      <Route path="/q/:slug" element={<DynamicQuizPage />} />

      {/* Test route — booking calendar in isolation */}
      <Route path="/test-booking" element={
        <div className="min-h-screen bg-[#F7F8FA]">
          <div className="bg-[#4CA994] text-white text-center py-3 px-4 text-sm font-semibold">
            TEST — Booking Calendar
          </div>
          <div className="max-w-lg mx-auto px-4 py-6">
            <div className="bg-[#4CA994]/5 border border-[#4CA994]/20 rounded-2xl p-5">
              <BookingCalendar
                nombre="Test Usuario"
                email="test@test.com"
                telefono="600000000"
              />
            </div>
          </div>
        </div>
      } />
    </Routes>
  )
}

export default App
