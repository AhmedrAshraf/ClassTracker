import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, email, message, survey } = await req.json()

    // Validate required fields
    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const apiKey = Deno.env.get("EMAIL_API_KEY");
    const serviceUrl = "https://api.sendgrid.com/v3/mail/send";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Format email body
    let emailBody = `
📬 New App Feedback Submission

👤 Name: ${name}
📧 Email: ${email}
📝 Message: ${message || "(none)"}
`;

    // Add survey responses if provided
    if (survey) {
      emailBody += `

📊 Survey Responses:
- Frequency of Use: ${survey.frequency || 'Not answered'}
- Ease of Use (1-5): ${survey.easeOfUse || 'Not answered'}
- Usefulness (1-5): ${survey.usefulness || 'Not answered'}
- Data Accuracy (1-5): ${survey.accuracy || 'Not answered'}
- Would Recommend: ${survey.recommend || 'Not answered'}
- Additional Comments: ${survey.additionalComments || 'None'}
`;
    }

    emailBody += `

Submitted at: ${new Date().toISOString()}
`;

    const payload = {
      personalizations: [{ 
        to: [{ email: "aapp1971@gmail.com" }],
        subject: `App Feedback from ${name}`
      }],
      from: { 
        email: "noreply@yourapp.com", // Replace with your verified sender
        name: "ClassTracker App"
      },
      content: [{
        type: "text/plain",
        value: emailBody
      }]
    };

    const response = await fetch(serviceUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('SendGrid error:', text);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error processing feedback:', error)
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
});