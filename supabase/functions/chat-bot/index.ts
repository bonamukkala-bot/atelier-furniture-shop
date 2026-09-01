import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function callGroq(model: string, systemPrompt: string, question: string) {
  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: 300,
      }),
    })

    if (groqResponse.status === 429) {
      console.error('Groq call failed:', { model, status: 429 })
      return { ok: false, status: 429 }
    }

    if (!groqResponse.ok) {
      console.error('Groq call failed:', { model, status: groqResponse.status })
      return { ok: false, status: groqResponse.status }
    }

    const groqData = await groqResponse.json()
    const content = groqData.choices?.[0]?.message?.content
    if (!content) {
      console.error('Groq call failed:', { model, status: groqResponse.status, error: 'No valid content' })
      return { ok: false, status: groqResponse.status }
    }

    return { ok: true, answer: content, status: 200 }
  } catch (err) {
    console.error('Groq call failed:', { model, error: String(err) })
    return { ok: false, status: 500 }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { question } = await req.json()

    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing question' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Connect to Supabase using the service role key (server-side only, never exposed to browser)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Pull current in-stock products so the bot only ever answers with real data
    const { data: products } = await supabase
      .from('products')
      .select('name, category, material, price, stock_qty')
      .eq('sold', false)

    const productContext = (products ?? [])
      .map(
        (p) =>
          `- ${p.name} (${p.category}, ${p.material}): ₹${p.price}, ${p.stock_qty} in stock`
      )
      .join('\n')

    const systemPrompt = `You are a helpful assistant for a furniture shop. Answer customer questions using ONLY the product data below. If asked about something not in this list, say it's not currently available. Keep answers short and friendly.

Current products:
${productContext || 'No products currently available.'}`

    const primaryModel = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-20b'
    const fallbackModel = Deno.env.get('GROQ_FALLBACK_MODEL') ?? 'llama-3.3-70b-versatile'

    let result = await callGroq(primaryModel, systemPrompt, question)

    // If primary model call fails, attempt one retry with the fallback model
    if (!result.ok) {
      result = await callGroq(fallbackModel, systemPrompt, question)
    }

    if (result.ok && result.answer) {
      return new Response(JSON.stringify({ answer: result.answer }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (result.status === 429) {
      return new Response(
        JSON.stringify({ answer: "We're getting a lot of questions right now! Please try again in a few seconds, or call/WhatsApp us directly." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ answer: "I'm having trouble answering right now — please message us on WhatsApp or call us directly, and we'll help right away." }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})