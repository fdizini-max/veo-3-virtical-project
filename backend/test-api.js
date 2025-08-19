const API_KEY = 'AIzaSyDV8WVlDCnZYuhta_m9YsgMHt3U7FYQwTw';

async function testAPI() {
  console.log('Testing API key:', API_KEY.slice(0, 10) + '...');
  
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello' }] }]
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response body:', text.slice(0, 500));
    
    if (response.ok) {
      console.log('✅ API key is working!');
    } else {
      console.log('❌ API key failed with status:', response.status);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

testAPI();
