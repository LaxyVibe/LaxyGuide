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
        const {pdfBase64, customPrompt} = req.body;

        if (!pdfBase64) {
          res.status(400).json({error: "PDF data is required"});
          return;
        }

        if (!customPrompt) {
          res.status(400).json({error: "Custom prompt is required"});
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

        // Prepare prompt for Vertex AI - Japanese-focused extraction
        const prompt = customPrompt

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

// AI Copilot for text processing
export const aiCopilot = onRequest(
    {
      timeoutSeconds: 60,
      memory: "1GiB",
      cors: true,
    },
    async (req, res) => {
      // Set CORS headers manually
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({error: "Method not allowed"});
        return;
      }

      try {
        const {prompt, text, language} = req.body;

        if (!prompt || !text) {
          res.status(400).json({error: "Prompt and text are required"});
          return;
        }

        logger.info("Processing AI Copilot request...");

        // Initialize Vertex AI
        const projectId = process.env.VERTEX_AI_PROJECT_ID || "laxy-guide";
        const location = process.env.VERTEX_AI_LOCATION || "us-central1";

        const vertexAI = new VertexAI({
          project: projectId,
          location: location,
        });

        const model = vertexAI.getGenerativeModel({
          model: "gemini-2.0-flash-exp",
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 2048,
          },
        });

        const languageNames: Record<string, string> = {
          "en-US": "English (US)",
          "ja-JP": "Japanese",
          "ko-KR": "Korean",
          "zh-TW": "Traditional Chinese",
          "zh-CN": "Simplified Chinese",
          "fr-FR": "French",
        };

        const fullPrompt = `You are a professional content editor for tourism materials.

Language: ${languageNames[language] || language}
Task: ${prompt}

Original Text:
${text}

Instructions:
1. Perform the requested task on the text
2. Maintain the same language (${languageNames[language] || language})
3. Keep the content appropriate for tourists
4. Return ONLY the processed text, no explanations or markdown formatting
5. Do not add quotes or extra formatting around your response

Processed Text:`;

        const result = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: fullPrompt,
                },
              ],
            },
          ],
        });

        const response = result.response;
        let processedText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Clean the response
        processedText = processedText.trim();
        
        // Remove markdown code blocks if present
        if (processedText.startsWith("```")) {
          processedText = processedText.replace(/^```[a-z]*\s*/, "").replace(/```\s*$/, "");
        }

        // Remove surrounding quotes if present
        if ((processedText.startsWith('"') && processedText.endsWith('"')) ||
            (processedText.startsWith("'") && processedText.endsWith("'"))) {
          processedText = processedText.slice(1, -1);
        }

        logger.info("AI Copilot processing complete");

        res.json({
          success: true,
          data: {
            processedText: processedText,
          },
        });
      } catch (error: unknown) {
        logger.error("AI Copilot error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    }
);

// Translation function using Vertex AI
export const translateContent = onRequest(
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
        const {guideTitle, pois, sourceLanguage, targetLanguage, customPrompt} = req.body;

        if (!guideTitle || !pois || !sourceLanguage || !targetLanguage) {
          res.status(400).json({error: "Missing required fields"});
          return;
        }

        logger.info(`Translating from ${sourceLanguage} to ${targetLanguage}...`);

        // Initialize Vertex AI
        const projectId = process.env.VERTEX_AI_PROJECT_ID || "laxy-guide";
        const location = process.env.VERTEX_AI_LOCATION || "us-central1";

        const vertexAI = new VertexAI({
          project: projectId,
          location: location,
        });

        const model = vertexAI.getGenerativeModel({
          model: "gemini-2.0-flash-exp",
          generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 8192,
          },
        });

        // Create translation prompt
        const languageNames: Record<string, string> = {
          "en-US": "English (US)",
          "ja-JP": "Japanese",
          "ko-KR": "Korean",
          "zh-TW": "Traditional Chinese",
          "zh-CN": "Simplified Chinese",
          "fr-FR": "French",
        };

        // Use custom prompt if provided, otherwise use default
        const defaultPrompt = `You are a professional translator specializing in tourism and cultural content. Translate the following guide content from ${languageNames[sourceLanguage]} to ${languageNames[targetLanguage]}.

Guide Title: "${guideTitle}"

POIs (Points of Interest):
${pois.map((poi: {number: string; title: string; content: string; script?: string}) => `
POI ${poi.number}:
Title: ${poi.title}
Content: ${poi.content}
${poi.script ? `Script: ${poi.script}` : ''}
`).join("\n")}

Return a JSON response with this EXACT structure:

{
  "guideTitle": "Translated guide title in ${languageNames[targetLanguage]}",
  "pois": [
    {
      "number": "001",
      "title": "Translated POI title in ${languageNames[targetLanguage]}",
      "content": "Translated POI content in ${languageNames[targetLanguage]}",
      "script": "Translated POI script in ${languageNames[targetLanguage]}"
    }
  ]
}

Translation guidelines:
1. Maintain the original meaning and cultural context
2. Use natural, fluent language appropriate for tourists
3. Keep the same tone and style as the original
4. Preserve any specific terms, names, or dates accurately
5. Ensure content length is similar to the original
6. For script field: translate narration script if present, maintaining conversational tone
7. Return ONLY valid JSON, no markdown formatting

Return ONLY the JSON structure, nothing else.`;

        const prompt = customPrompt || defaultPrompt;

        const result = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        });

        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

        logger.info("Translation received, parsing...");

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
        logger.error("Translation error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    }
);

