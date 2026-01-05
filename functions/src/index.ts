import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {VertexAI} from "@google-cloud/vertexai";

setGlobalOptions({maxInstances: 10});

export const processPdfVertex = onRequest(
    {
      timeoutSeconds: 540,
      memory: "2GiB",
      cors: true,
    },
    async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).json({error: "Method not allowed"});
        return;
      }

      try {
        const {pdfBase64, guideCode, numberOfPois} = req.body;

        if (!pdfBase64) {
          res.status(400).json({error: "PDF data is required"});
          return;
        }

        logger.info("Processing PDF with Vertex AI...");

        // Initialize Vertex AI
        const projectId = process.env.VERTEX_AI_PROJECT_ID || "laxy-guide";
        const location = process.env.VERTEX_AI_LOCATION || "us-central1";

        const vertexAI = new VertexAI({
          project: projectId,
          location: location,
        });

        // Get the Gemini model
        const model = vertexAI.getGenerativeModel({
          model: "gemini-2.0-flash-exp",
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
        "en-US": "Detailed description in English (2-3 paragraphs)",
        "ja-JP": "日本語での詳細説明（2〜3段落）",
        "ko-KR": "한국어로 된 상세 설명 (2-3 단락)",
        "zh-TW": "繁體中文詳細說明（2-3段）",
        "zh-CN": "简体中文详细说明（2-3段）",
        "fr-FR": "Description détaillée en français (2-3 paragraphes)"
      },
      "hero": "",
      "displayAudio": true,
      "ttml": ""
    }
  ]
}

Important guidelines:
1. Extract ${numberOfPois} most significant points of interest from the PDF
2. Number POIs sequentially: "001", "002", "003", etc.
3. Generate authentic, culturally appropriate content for each language
4. Keep content informative yet engaging (2-3 paragraphs per POI)
5. Return ONLY valid JSON, no markdown formatting
6. If the PDF is in a specific language, use that as the primary source and translate to others

Return ONLY the JSON structure, nothing else.`;

        const result = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
        });

        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

        logger.info("AI Response received, parsing...");

        // Clean the response text
        let cleanedText = text.trim();
        if (cleanedText.startsWith("```json")) {
          cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/```\s*$/, "");
        } else if (cleanedText.startsWith("```")) {
          cleanedText = cleanedText.replace(/^```\s*/, "").replace(/```\s*$/, "");
        }

        const parsedData = JSON.parse(cleanedText);

        res.json({
          success: true,
          data: parsedData,
        });
      } catch (error: unknown) {
        logger.error("Error processing PDF:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    }
);

// GitHub OAuth for Decap CMS
export const auth = onRequest(
    {
      cors: true,
    },
    async (req, res) => {
      const {code, scope} = req.query;

      // Step 1: Redirect to GitHub OAuth if no code present
      if (!code) {
        const clientId = process.env.GITHUB_CLIENT_ID;
        if (!clientId) {
          res.status(500).send("GitHub OAuth not configured");
          return;
        }

        const redirectUri = `${req.protocol}://${req.get("host")}${req.path}`;
        const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope || "repo,user"}`;

        res.redirect(githubAuthUrl);
        return;
      }

      // Step 2: Exchange code for token
      try {
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: code,
          }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
          throw new Error(tokenData.error_description || tokenData.error);
        }

        // Return token in the format Decap CMS expects
        res.send(`
          <html>
            <body>
              <script>
                (function() {
                  function receiveMessage(e) {
                    console.log("Received message:", e);
                    window.opener.postMessage(
                      'authorization:github:success:${JSON.stringify({token: tokenData.access_token, provider: "github"})}',
                      e.origin
                    );
                  }
                  window.addEventListener("message", receiveMessage, false);
                  window.opener.postMessage("authorizing:github", "*");
                })();
              </script>
              <p>Authorization successful. This window should close automatically.</p>
            </body>
          </html>
        `);
      } catch (error) {
        logger.error("GitHub OAuth error:", error);
        res.status(500).send(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
);
