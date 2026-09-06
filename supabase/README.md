# Supabase backend

Server-side pieces of MediMind. Nothing here ships inside the app bundle.

| Function | Purpose |
|---|---|
| `functions/assistant` | Holds the Anthropic API key and answers "Ask MediMind" questions with Claude. |

## Deploying the assistant

1. Install the Supabase CLI and link the project: `supabase link --project-ref <ref>`
2. Set the secret: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
3. Deploy: `supabase functions deploy assistant`
4. In the app's `.env.local`:
   `EXPO_PUBLIC_ASSISTANT_ENDPOINT=https://<ref>.supabase.co/functions/v1/assistant`
5. In the app, turn **Demo Mode off** in Settings. The assistant badge changes
   from "Offline assistant" to "AI assistant".

Until then the app uses its built-in offline assistant, which answers from the
user's saved records without any network.

The function validates every field it receives, caps question length and
history, and never logs the user's medicines.
