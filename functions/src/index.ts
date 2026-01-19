import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {VertexAI} from "@google-cloud/vertexai";
import {SchemaType} from "@google-cloud/vertexai/build/src/types/common";

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

        // Get the Gemini model with JSON response schema
        const responseSchema = {
          type: SchemaType.OBJECT,
          properties: {
            guide: {
              type: SchemaType.OBJECT,
              properties: {
                titles: {
                  type: SchemaType.OBJECT,
                  properties: {
                    "ja-JP": {type: SchemaType.STRING},
                  },
                  required: ["ja-JP"],
                },
              },
              required: ["titles"],
            },
            pois: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  number: {type: SchemaType.STRING},
                  titles: {
                    type: SchemaType.OBJECT,
                    properties: {
                      "ja-JP": {type: SchemaType.STRING},
                    },
                    required: ["ja-JP"],
                  },
                  content: {
                    type: SchemaType.OBJECT,
                    properties: {
                      "ja-JP": {type: SchemaType.STRING},
                    },
                    required: ["ja-JP"],
                  },
                },
                required: ["number", "titles", "content"],
              },
            },
          },
          required: ["guide", "pois"],
        };

        const model = vertexAI.getGenerativeModel({
          model: "gemini-2.0-flash-exp",
          generationConfig: {
            temperature: 0.4, // Lower temperature for more consistent JSON output
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: "application/json", // Force JSON output
            responseSchema: responseSchema,
          },
        });

        // Use the custom prompt directly from the frontend
        // This allows users to tune the prompt via the UI
        logger.info("Using custom prompt from frontend");

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
                  text: customPrompt,
                },
              ],
            },
          ],
        });

        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

        logger.info("AI Response received, parsing...");
        logger.info("Raw AI response:", text.substring(0, 200)); // Log first 200 chars for debugging

        // Clean the response text
        let cleanedText = text.trim();
        
        // Remove markdown code blocks
        if (cleanedText.startsWith("```json")) {
          cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/```\s*$/, "");
        } else if (cleanedText.startsWith("```")) {
          cleanedText = cleanedText.replace(/^```\s*/, "").replace(/```\s*$/, "");
        }
        
        // Remove any leading text before the JSON
        const jsonStart = cleanedText.indexOf("{");
        const jsonEnd = cleanedText.lastIndexOf("}");
        
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error("No valid JSON object found in AI response. Response started with: " + cleanedText.substring(0, 100));
        }
        
        cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);

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

        // Validate input
        if (!guideTitle || !pois || !sourceLanguage || !targetLanguage || !customPrompt) {
          res.status(400).json({
            success: false,
            error: "Missing required fields: guideTitle, pois, sourceLanguage, targetLanguage, customPrompt",
          });
          return;
        }

        if (!Array.isArray(pois) || pois.length === 0) {
          res.status(400).json({
            success: false,
            error: "pois must be a non-empty array",
          });
          return;
        }

        logger.info("=== Translation Request ===");
        logger.info(`Source: ${sourceLanguage} (${sourceLanguageName}) → Target: ${targetLanguage} (${targetLanguageName})`);
        logger.info(`Guide Title: ${guideTitle}`);
        logger.info(`Number of POIs: ${pois.length}`);
        logger.info(`⚠️ TRANSLATING TO: ${targetLanguageName.toUpperCase()} ⚠️`);

        // Initialize Vertex AI
        const projectId = process.env.VERTEX_AI_PROJECT_ID || "laxy-guide";
        const location = process.env.VERTEX_AI_LOCATION || "us-central1";

        const vertexAI = new VertexAI({
          project: projectId,
          location: location,
        });

        // Strict JSON schema for translation output
        const translationSchema = {
          type: SchemaType.OBJECT,
          properties: {
            guideTitle: {
              type: SchemaType.STRING,
              description: "Translated guide title",
            },
            pois: {
              type: SchemaType.ARRAY,
              description: "Array of translated POIs",
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  number: {
                    type: SchemaType.STRING,
                    description: "POI number (unchanged from source)",
                  },
                  title: {
                    type: SchemaType.STRING,
                    description: "Translated POI title",
                  },
                  content: {
                    type: SchemaType.STRING,
                    description: "Translated POI content",
                  },
                  script: {
                    type: SchemaType.STRING,
                    description: "Translated POI narration script",
                  },
                },
                required: ["number", "title", "content", "script"],
              },
            },
          },
          required: ["guideTitle", "pois"],
        };

        // Initialize model with strict JSON mode
        const model = vertexAI.getGenerativeModel({
          model: "gemini-2.0-flash-exp",
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: translationSchema,
          },
        });

        // Build structured prompt
        const languageNames: Record<string, string> = {
          "en-US": "English",
          "ja-JP": "Japanese",
          "ko-KR": "Korean",
          "zh-TW": "Traditional Chinese",
          "zh-CN": "Simplified Chinese",
          "fr-FR": "French",
        };

        const sourceLanguageName = languageNames[sourceLanguage] || sourceLanguage;
        const targetLanguageName = languageNames[targetLanguage] || targetLanguage;

        // Format POIs for prompt
        const poisFormatted = pois.map((poi: {number: string; title: string; content: string; script?: string}) => {
          return `POI ${poi.number}:
- Title: ${poi.title}
- Content: ${poi.content}
- Script: ${poi.script || "(empty)"}`;
        }).join("\n\n");

        // Build the complete prompt with clear language specification
        const fullPrompt = `${customPrompt}

==========================================================
TRANSLATION SPECIFICATION:
==========================================================
SOURCE LANGUAGE: ${sourceLanguageName} (${sourceLanguage})
TARGET LANGUAGE: ${targetLanguageName} (${targetLanguage})

YOU MUST TRANSLATE ALL TEXT BELOW TO ${targetLanguageName.toUpperCase()}.
==========================================================

GUIDE TITLE TO TRANSLATE:
${guideTitle}

POIs TO TRANSLATE:
${poisFormatted}

==========================================================
REMINDER: Translate everything to ${targetLanguageName} (${targetLanguage}).
Return JSON with this structure:
{
  "guideTitle": "translated to ${targetLanguageName}",
  "pois": [
    {
      "number": "unchanged",
      "title": "translated to ${targetLanguageName}",
      "content": "translated to ${targetLanguageName}",
      "script": "translated to ${targetLanguageName}"
    }
  ]
}
==========================================================`;

        logger.info("Sending translation request to Vertex AI...");

        const result = await model.generateContent({
          contents: [{
            role: "user",
            parts: [{text: fullPrompt}],
          }],
        });

        const candidate = result.response.candidates?.[0];
        if (!candidate) {
          throw new Error("No response candidate returned from AI");
        }

        const rawText = candidate.content?.parts?.[0]?.text || "";
        
        logger.info("=== AI Response ===");
        logger.info(`Response length: ${rawText.length} chars`);
        logger.info(`First 200 chars: ${rawText.substring(0, 200)}`);
        logger.info("=== COMPLETE RAW AI RESPONSE ===");
        logger.info(rawText);
        logger.info("=== END COMPLETE RESPONSE ===");

        if (!rawText) {
          throw new Error("Empty response from AI");
        }

        // AGGRESSIVE JSON EXTRACTION
        // Despite responseMimeType: "application/json", Gemini sometimes adds text before the JSON
        // We need to extract ONLY the JSON object
        
        let jsonText = rawText.trim();
        let parsedData;

        // First, always try to find JSON boundaries regardless of whether initial parse succeeds
        const firstBrace = jsonText.indexOf("{");
        const lastBrace = jsonText.lastIndexOf("}");
        
        if (firstBrace === -1 || lastBrace === -1) {
          logger.error("No JSON object found in response");
          logger.error("=== FULL RAW RESPONSE ===");
          logger.error(rawText);
          logger.error("=== END FULL RESPONSE ===");
          throw new Error(`AI did not return a valid JSON object. Response was: ${rawText.substring(0, 500)}`);
        }

        // If there's text before the JSON, log it and remove it
        if (firstBrace > 0) {
          const prefixText = jsonText.substring(0, firstBrace);
          logger.warn(`Found and removing ${firstBrace} chars before JSON`);
          logger.warn("=== PROBLEMATIC PREFIX TEXT ===");
          logger.warn(prefixText);
          logger.warn("=== END PREFIX ===");
        }

        // Extract only the JSON portion
        jsonText = jsonText.substring(firstBrace, lastBrace + 1);
        
        logger.info("Extracted JSON (first 300 chars):", jsonText.substring(0, 300));

        // Now try to parse the extracted JSON
        try {
          parsedData = JSON.parse(jsonText);
          logger.info("JSON parsed successfully");
        } catch (parseError) {
          logger.error("JSON parse failed even after extraction");
          logger.error("Parse error:", parseError);
          logger.error("=== JSON TEXT THAT FAILED TO PARSE ===");
          logger.error(jsonText);
          logger.error("=== END FAILED JSON ===");
          
          const errorMsg = parseError instanceof Error ? parseError.message : "Unknown parse error";
          throw new Error(`Failed to parse extracted JSON. Error: ${errorMsg}. Extracted text: ${jsonText.substring(0, 500)}`);
        }

        logger.info("JSON parsed successfully");

        // Validate structure
        if (!parsedData || typeof parsedData !== "object") {
          throw new Error("Parsed data is not an object");
        }

        if (!parsedData.guideTitle || typeof parsedData.guideTitle !== "string") {
          throw new Error("Missing or invalid guideTitle in response");
        }

        if (!Array.isArray(parsedData.pois)) {
          throw new Error("Missing or invalid pois array in response");
        }

        if (parsedData.pois.length !== pois.length) {
          logger.warn(`POI count mismatch: expected ${pois.length}, got ${parsedData.pois.length}`);
        }

        // Validate each POI
        for (let i = 0; i < parsedData.pois.length; i++) {
          const poi = parsedData.pois[i];
          if (!poi.number || !poi.title || !poi.content) {
            logger.error(`POI at index ${i} missing required fields:`, JSON.stringify(poi));
            throw new Error(`POI ${i} is missing required fields (number, title, or content)`);
          }
          // Ensure script exists (can be empty string)
          if (!poi.script) {
            poi.script = "";
          }
        }

        logger.info("=== Translation Success ===");
        logger.info(`Translated guide title: ${parsedData.guideTitle.substring(0, 50)}...`);
        logger.info(`Translated ${parsedData.pois.length} POIs`);

        res.json({
          success: true,
          data: {
            guideTitle: parsedData.guideTitle,
            pois: parsedData.pois,
          },
        });
      } catch (error: unknown) {
        logger.error("=== Translation Error ===");
        logger.error(error);
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    }
);

