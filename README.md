# Greenzar Food and Beverage Billing Software

This is a Next.js/React application for billing and invoicing, using Google Sheets as a database and Google Gemini AI for intelligent features.

## Prerequisites

To run this application, you need the following API keys:

1.  **Google Sheets Service Account:**
    *   Go to [Google Cloud Console](https://console.cloud.google.com/).
    *   Create a new project.
    *   Enable the **Google Sheets API**.
    *   Create a **Service Account**.
    *   Create a JSON key for the service account and download it.
    *   Share your Google Sheet with the service account email address (found in the JSON file).

2.  **Google Gemini API Key:**
    *   Go to [Google AI Studio](https://aistudio.google.com/).
    *   Get an API key.

## Environment Variables

Create a `.env.local` file in the root directory (for local development) or set these variables in your deployment platform (Vercel, Netlify, etc.):

```env
# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account-email@project-id.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Private Key Here\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID="your-google-sheet-id"

# Gemini AI Configuration
GEMINI_API_KEY="your-gemini-api-key"
```

> **Note:** When deploying to Vercel/Netlify, ensure the `GOOGLE_PRIVATE_KEY` is correctly formatted (replace literal `\n` with actual newlines if the platform requires it, or wrap the whole key in quotes).

## Deployment

### Vercel (Recommended)

1.  Push your code to a Git repository (GitHub, GitLab, Bitbucket).
2.  Import the project into Vercel.
3.  In the **Environment Variables** section, add the keys listed above.
4.  Deploy.

### Netlify

1.  Push your code to a Git repository.
2.  Import the project into Netlify.
3.  In **Site settings > Build & deploy > Environment**, add the keys.
4.  Deploy.

Once deployed, the application will use these server-side environment variables and **will not ask the user for keys**.
