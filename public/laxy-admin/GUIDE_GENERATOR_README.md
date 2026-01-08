# AI Guide Generator - New Workflow

## Overview

The redesigned AI Guide Generator follows a clear 3-step workflow optimized for content creation:

### Step 1: Upload PDF & Generate Japanese Content
- Upload a PDF document (museum guide, attraction brochure, etc.)
- Specify guide code, image URL, and number of POIs to extract
- AI extracts and generates content **in Japanese only**
- Focuses on quality extraction from the source material

### Step 2: Review & Edit Japanese Content
- Review all AI-generated Japanese content
- Manually edit and fine-tune:
  - Guide title
  - POI titles and descriptions
  - Hero images
  - Audio settings
  - TTML subtitles
- Add or remove POIs as needed
- Save progress at any time

### Step 3: Translate & Publish
- AI translates Japanese content to all languages:
  - English (en-US)
  - Korean (ko-KR)
  - Traditional Chinese (zh-TW)
  - Simplified Chinese (zh-CN)
  - French (fr-FR)
- Visual progress tracking for each language
- Publish directly to GitHub when ready

## Files Structure

```
public/laxy-admin/
├── guide-generator.html              # Redirects to step 1
├── guide-generator-step1.html        # Step 1: PDF Upload
├── guide-generator-step2.html        # Step 2: Review & Edit
├── guide-generator-step3.html        # Step 3: Translate & Publish
└── guide-generator-shared.js         # Shared utilities
```

## Backend Functions

### `processPdfVertex`
- Accepts PDF file (base64), guide code, and number of POIs
- Extracts content in Japanese using Vertex AI (Gemini 2.0 Flash)
- Returns structured JSON with guide and POI data

### `translateContent`
- Accepts Japanese content and target language
- Translates guide title and all POI content
- Maintains cultural context and natural fluency

## Key Features

### Session Management
- Data persists across steps using `sessionStorage`
- Can navigate back and forth between steps
- Progress is saved automatically

### Validation
- Guide code format validation: `COUNTRY-CITY-TYPE-NUMBER`
- Required fields checking before proceeding
- Content completeness validation

### User Experience
- Clear step indicators showing progress
- Expandable/collapsible POI cards for easier management
- Real-time character counting
- Toast notifications for actions
- Status messages during AI processing

## API Endpoints

### Development (Local)
```
PDF Processing: http://127.0.0.1:5001/laxy-guide-dev/us-central1/processPdfVertex
Translation: http://127.0.0.1:5001/laxy-guide-dev/us-central1/translateContent
```

### Production
```
PDF Processing: https://processpdfvertex-kwy6rt2iqq-uc.a.run.app
Translation: https://translatecontent-kwy6rt2iqq-uc.a.run.app
```

## Data Format

### Guide Data Structure
```javascript
{
  code: "JPN-OSAKA-MUS-001",
  guideUnderlayImage: "https://...",
  titles: {
    "ja-JP": "日本語タイトル",
    "en-US": "English Title",
    // ... other languages
  },
  pois: [
    {
      number: "001",
      title: { "ja-JP": "...", "en-US": "...", ... },
      hero: "https://...",
      displayAudio: true,
      ttml: "https://...",
      content: { "ja-JP": "...", "en-US": "...", ... }
    }
  ],
  sourceLanguage: "ja-JP"
}
```

## Deployment

After making changes, deploy the functions:

```bash
firebase deploy --only functions
```

Or deploy everything:

```bash
firebase deploy
```

## Benefits of New Workflow

1. **Focused AI Generation**: Extract Japanese content first for better quality
2. **Human Review**: Ensure accuracy before translation
3. **Efficient Translation**: Batch translate all languages at once
4. **Better UX**: Clear steps, progress tracking, data persistence
5. **Modular Code**: Separate files for easier maintenance
6. **Reusable Components**: Shared utilities across all steps

## Future Enhancements

- [ ] Support for multiple source languages
- [ ] Image upload and Cloudinary integration
- [ ] TTML editor integration
- [ ] Batch PDF processing
- [ ] Preview mode before publishing
- [ ] Draft saving to database
