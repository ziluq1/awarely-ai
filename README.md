# Awarely

**Website:** https://awarely-ai.vercel.app

A private journaling app with an AI companion for the moments you need to pause. Snap an optional photo, note your mood, write a short reflection, and talk it through with a chatbot built for grounding and self-reflection. It listens, asks gentle questions, and helps you slow down. It does not diagnose, treat, or replace crisis support.

**Who it's for:** anyone who wants a calm place to check in with themselves. Most journaling apps are a blank page, and most chatbots are built to answer questions, not to help you notice how you feel. Awarely pairs a private timeline with an AI companion that stays in reflection mode: it mirrors back what you wrote, helps you name the feeling, and offers simple grounding prompts. It won't give medical advice, and it points you to real help when a conversation needs more than an app can offer.

## Features

- **AI companion:** a chat built for grounding and reflection, not diagnosis or advice. It can talk through an entry with you or just help you settle.
- **Check-in entries:** an optional photo, a mood, and a short written reflection.
- **Personal timeline:** every entry lands in your own timeline, tied to your account.
- **Private by default:** entries stay with your account and photos are private.
- **Shared timelines:** choose specific moments to share with friends on separate timelines. Nothing is shared unless you pick it.

## What it is not

Awarely is not medical care, therapy, or crisis support. If you're in crisis, contact local emergency services or a crisis line (in the US, call or text 988).

## Tech

Next.js (App Router) on Vercel, with Supabase for auth and data (email and Google sign-in). Cloudflare Turnstile protects the login, signup, and password reset forms. The AI companion runs on the Gemini API.

## Run locally

```bash
git clone <your-repo-url>
cd <your-repo>
npm install
cp .env.example .env.local   # add your Supabase and Gemini keys
npm run dev
```

Then open http://localhost:3000.


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
