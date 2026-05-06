# AG-MCQ-Reasoning-Assistant

A React-based application for managing and reasoning through multiple-choice questions using Google Gemini AI.

## Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn** package manager
- **Git** (for cloning and deployment)
- **Cloudflare Account** (for hosting on Cloudflare Pages)
- **Google Gemini API Key** (for AI features)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AG-MCQ-Reasoning-Assistant
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

Replace `your_google_gemini_api_key_here` with your actual Google Gemini API key.

---

## Testing Locally

### Start Development Server

Run the development server with hot module reloading:

```bash
npm run dev
```

The application will be available at:
- **Local**: `http://localhost:3000`
- **Network**: `http://<your-ip>:3000`

### Build for Production

Create an optimized production build:

```bash
npm run build
```

The build output will be generated in the `dist/` directory.

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

This allows you to test the production build before deployment.

### Clean Build

Remove the `dist/` directory:

```bash
npm clean
```

### Linting

Check TypeScript types:

```bash
npm run lint
```

---

## Hosting on Cloudflare Pages

### Prerequisites

- Cloudflare account (free or paid)
- Git repository (GitHub, GitLab, or Gitbucket)

### Step 1: Prepare Your Repository

1. Push your code to a Git repository (GitHub, GitLab, or Gitbucket)
2. Ensure your `.env` file is **NOT** committed to Git (add it to `.gitignore`)

### Step 2: Configure in Cloudflare Dashboard

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **Pages** section from the sidebar
3. Click **Create a project**
4. Select **Connect to Git**
5. Choose your Git provider (GitHub, GitLab, or Gitbucket)
6. Authorize Cloudflare to access your repositories
7. Select your `AG-MCQ-Reasoning-Assistant` repository

### Step 3: Build Configuration

In the deployment setup page, configure:

- **Framework preset**: `Vite`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (or leave empty)

### Step 4: Environment Variables

1. In the Cloudflare Pages project settings, go to **Settings** → **Environment variables**
2. Add the following variable:

| Variable Name | Value |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key |

3. Set the environment for which this applies:
   - **Production** (for main branch)
   - **Preview** (for preview deployments)

### Step 5: Deploy

1. Click **Save and Deploy**
2. Cloudflare will automatically:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Run the build command (`npm run build`)
   - Deploy the `dist` folder to Cloudflare's global network

### Step 6: Access Your Site

Once deployed, your site will be available at:
```
https://<project-name>.<username>.pages.dev
```

You can find this URL in the Cloudflare Pages project dashboard.

### Subsequent Deployments

Any push to your repository's main branch will automatically trigger a new deployment. Preview deployments are created for pull requests.

### Custom Domain (Optional)

1. Go to your Cloudflare Pages project
2. Click **Custom domains**
3. Add your custom domain
4. Follow the DNS instructions provided by Cloudflare

---

## Project Structure

```
.
├── src/
│   ├── App.tsx           # Main React component
│   ├── main.tsx          # Application entry point
│   ├── index.css         # Global styles
│   └── data/
│       ├── questions.json
│       └── questions-sample.json
├── dist/                 # Production build (generated)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── README.md             # This file
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI features |

---

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, modify the dev script in `package.json`:

```bash
npm run dev -- --port=3001
```

### Build Fails on Cloudflare

1. Check that all environment variables are set in Cloudflare Pages settings
2. Ensure `dist/` directory is not in `.gitignore`
3. Verify Node.js version compatibility (Cloudflare Pages uses Node 18+ by default)

### API Key Not Working

1. Verify your Google Gemini API key is correct
2. Check that the `.env` file is in the root directory (for local development)
3. For Cloudflare Pages, ensure the environment variable is set in the project settings

---

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Check TypeScript types
- `npm run clean` - Remove build artifacts

### Dependencies

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS
- **Google Genai** - AI integration
- **React Markdown** - Markdown rendering
- **KaTeX** - Math formula rendering

---

## License

[Add your license information here]

## Support

For issues or questions, please open an issue in the repository.
