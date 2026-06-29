export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } })
  }
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })
  try {
    const data = await req.json()
    const digits = (data.phone || '').replace(/\D/g, '')
    const phone = digits.length === 10 ? '+1' + digits : digits.length === 11 ? '+' + digits : data.phone
    const zapierUrl = 'https://hooks.zapier.com/hooks/catch/172130/uewbyeb/'
    const r = await fetch(zapierUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "Texting Cell": phone,
        "Person First Name": data.firstName || '',
        "SMS": data.message || '',
        "Deal ID": data.dealId || '',
        "phoneNumberTo": phone,
        "text": data.message || ''
      })
    })
    const result = await r.text()
    return new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
