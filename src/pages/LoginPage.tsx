import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      navigate('/admin')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4 font-inter">
      <div className="w-full max-w-md bg-white border border-[#E4DDD1] p-8 md:p-10 shadow-2xl relative">
        {/* Accent Top Border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#B8874B]" />
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="text-center pb-2">
            <span className="font-fraunces text-3xl font-semibold tracking-tight text-[#2B2420]">ATELIER</span>
            <h2 className="text-xs uppercase tracking-widest text-[#B8874B] font-semibold mt-1">Owner Access</h2>
          </div>

          {error && (
            <div className="bg-[#4A3728]/5 border border-[#E4DDD1] text-xs text-[#4A3728] p-3 text-center leading-relaxed">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[#6B7259] font-semibold mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[#E4DDD1] bg-[#FAF7F2]/50 text-[#2B2420] p-3 text-sm rounded-none focus:outline-none focus:border-[#B8874B] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4A3728] hover:bg-[#2B2420] text-[#FAF7F2] py-3 text-xs uppercase tracking-widest font-semibold rounded-none disabled:opacity-50 transition-colors duration-300"
          >
            {loading ? 'Verifying Credentials...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage