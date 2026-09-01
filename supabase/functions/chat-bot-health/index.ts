const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function testGroqModel(model: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) {
      return { ok: false, error: 'GROQ_API_KEY environment variable is not configured' }
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Reply with only the word OK' },
          { role: 'user', content: 'ping' },
        ],
        max_tokens: 150,
      }),
    })

    if (!response.ok) {
      return { ok: false, status: response.status, error: `Groq returned HTTP ${response.status}` }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return { ok: false, status: response.status, error: 'Groq response contained no message content' }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const primaryModel = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-20b'
  const fallbackModel = Deno.env.get('GROQ_FALLBACK_MODEL') ?? 'llama-3.3-70b-versatile'

  // Test primary model
  const primaryResult = await testGroqModel(primaryModel)
  if (primaryResult.ok) {
    return new Response(
      JSON.stringify({ status: 'healthy', model: primaryModel }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Fallback test
  const fallbackResult = await testGroqModel(fallbackModel)
  if (fallbackResult.ok) {
    return new Response(
      JSON.stringify({ status: 'healthy', model: fallbackModel }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Both models failed
  const errorMessage = `Primary (${primaryModel}): ${primaryResult.error}; Fallback (${fallbackModel}): ${fallbackResult.error}`
  return new Response(
    JSON.stringify({ status: 'unhealthy', error: errorMessage }),
    {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
