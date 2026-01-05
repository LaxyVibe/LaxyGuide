const { VertexAI } = require('@google-cloud/vertexai');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { pdfBase64, guideCode, numberOfPois } = JSON.parse(event.body);

    if (!pdfBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'PDF data is required' }),
      };
    }

    // Initialize Vertex AI
    const projectId = process.env.VERTEX_AI_PROJECT_ID || 'laxy-guide';
    const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
    
    // Build credentials from individual environment variables or full JSON
    let credentials;
    
    // Option 1: Use individual fields (recommended for Netlify)
    if (process.env.VERTEX_AI_CLIENT_EMAIL && process.env.VERTEX_AI_PRIVATE_KEY) {
      credentials = {
        type: 'service_account',
        project_id: projectId,
        private_key: process.env.VERTEX_AI_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.VERTEX_AI_CLIENT_EMAIL,
      };
    } 
    // Option 2: Use full JSON key (for local dev)
    else if (process.env.VERTEX_AI_SERVICE_ACCOUNT_KEY) {
      try {
        credentials = JSON.parse(process.env.VERTEX_AI_SERVICE_ACCOUNT_KEY);
      } catch (error) {
        console.error('Failed to parse service account key');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Invalid service account configuration' }),
        };
      }
    } else {
      console.error('No Vertex AI credentials found');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Vertex AI credentials not configured' }),
      };
    }

    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
      googleAuthOptions: {
        credentials: credentials
      }
    });

    // Get the Gemini model
    const model = vertexAI.getGenerativeModel({
      model: 'gemini-1.5-flash-002',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    // Prepare prompt for Vertex AI
    const prompt = `You are a professional tour guide content generator. Analyze the provided PDF document and generate structured multilingual content for a digital tour guide.

Guide Code: ${guideCode}
Number of Points of Interest (POIs) to generate: ${numberOfPois}

Based on the PDF content, generate a JSON response with this EXACT structure:

{
  "guide": {
    "titles": {
      "en-US": "English title for the guide",
      "ja-JP": "日本語のガイドタイトル",
      "ko-KR": "가이드 제목 (한국어)",
      "zh-TW": "導覽標題 (繁體中文)",
      "zh-CN": "导览标题 (简体中文)",
      "fr-FR": "Titre du guide en français"
    }
  },
  "pois": [
    {
      "number": "001",
      "title": {
        "en-US": "POI title in English",
        "ja-JP": "POIタイトル（日本語）",
        "ko-KR": "POI 제목 (한국어)",
        "zh-TW": "POI標題 (繁體中文)",
        "zh-CN": "POI标题 (简体中文)",
        "fr-FR": "Titre POI en français"
      },
      "content": {
        "en-US": "2-3 paragraphs of engaging markdown content in English. Include interesting facts, historical context, and visitor information.",
        "ja-JP": "日本語で2〜3段落の魅力的なマークダウンコンテンツ。興味深い事実、歴史的背景、訪問者情報を含めてください。",
        "ko-KR": "한국어로 2-3개의 흥미로운 마크다운 콘텐츠 단락. 흥미로운 사실, 역사적 맥락 및 방문자 정보를 포함하세요.",
        "zh-TW": "2-3段吸引人的繁體中文markdown內容。包括有趣的事實、歷史背景和訪客資訊。",
        "zh-CN": "2-3段引人入胜的简体中文markdown内容。包括有趣的事实、历史背景和访客信息。",
        "fr-FR": "2-3 paragraphes de contenu markdown engageant en français. Incluez des faits intéressants, un contexte historique et des informations pour les visiteurs."
      }
    }
  ]
}

Important Rules:
1. Extract ${numberOfPois} key points of interest from the PDF
2. Create engaging, informative content suitable for tourists and visitors
3. Ensure all translations are accurate, natural, and culturally appropriate
4. Use proper markdown formatting (paragraphs, **bold**, *italic*, lists)
5. Each POI content should be 2-3 substantive paragraphs (150-250 words per language)
6. Number POIs sequentially starting from "001"
7. Return ONLY valid JSON, no additional text or explanation
8. If PDF doesn't have enough content for ${numberOfPois} POIs, generate fewer with quality content

Analyze the PDF and generate the multilingual tour guide content:`;

    console.log('Processing PDF with Vertex AI...');

    // Convert base64 to buffer for inline data
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Process PDF with Vertex AI
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
          ],
        },
      ],
    };

    const result = await model.generateContent(request);
    const response = result.response;
    const text = response.candidates[0].content.parts[0].text;

    console.log('AI Response received, parsing...');

    // Parse JSON response
    let generatedContent;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedContent = JSON.parse(jsonMatch[0]);
      } else {
        generatedContent = JSON.parse(text);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', text.substring(0, 500));
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to parse AI response',
          rawResponse: text.substring(0, 500),
        }),
      };
    }

    // Validate response structure
    if (!generatedContent.guide || !generatedContent.pois) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Invalid response structure from AI',
          data: generatedContent,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: generatedContent,
      }),
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to process PDF with Vertex AI',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
    };
  }
};
