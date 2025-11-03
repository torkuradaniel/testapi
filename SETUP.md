# API Testing Tool - Setup Instructions

## Prerequisites

- Node.js 18+ installed
- OpenAI API key

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env.local` file in the project root:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```
   
   Get your API key from: https://platform.openai.com/api-keys

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open the app:**
   
   Navigate to http://localhost:3000

## Features

### API Request Builder
- Configure HTTP method, base URL, path, and path parameters
- Set authentication (Bearer, Basic, API-Key)
- Add query parameters
- Define request body in JSON format

### AI-Powered Test Generation
- Enter natural language test pointers (e.g., "ensure to test when amount is 0")
- Specify the number of tests to generate (4-50)
- Click "Generate tests" to use OpenAI to create comprehensive test variations
- First 3 tests will directly satisfy your pointer
- Remaining tests cover edge cases, boundary conditions, type variations, etc.

### Test Queue
- View all generated tests
- Toggle between auto/manual run modes
- Run individual tests or all auto tests
- Tests are prioritized (user_requested first)

### Results Inspector
- View request/response details for each test run
- Replay failed requests
- Masked authorization headers for security

## API Backend

The app uses Next.js App Router API routes:

- **POST /api/generate-tests** - Generates tests using OpenAI
  - Request body: `{ pointer, requestConfig, count }`
  - Returns: `{ tests: [...], count: number }`

## Notes

- The mock API runner (`lib/mockApi.js`) simulates server responses for demo purposes
- For production, replace `runTest()` with actual API calls
- Logs are ephemeral (in-memory only)
- Tests are generated using GPT-4o-mini for cost efficiency
