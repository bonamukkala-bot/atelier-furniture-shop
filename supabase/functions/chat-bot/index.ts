import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: 300,
      }),
    })

    if (groqResponse.status === 429) {
  return new Response(
    JSON.stringify({ answer: "We're getting a lot of questions right now! Please try again in a few seconds, or call/WhatsApp us directly." }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

const groqData = await groqResponse.json()
const answer = groqData.choices?.[0]?.message?.content ?? 'Sorry, I could not process that.'

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})