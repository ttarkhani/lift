# Auth0 setup

Lifts signs people in with Auth0 and reads the organizer role from their ID token. Setting it up takes one Auth0 application, one role, and one post-login Action. Do it once per tenant; every teammate then uses the same values.

The Auth0 values are secrets. Share them privately (a password manager or a direct message), never through the repo, an issue, or a group chat.

## 1. Create the application

1. In the [Auth0 dashboard](https://manage.auth0.com), go to **Applications → Applications → Create Application**.
2. Name it `Lifts`, choose **Regular Web Application**, and select **Create**. Skip the quickstart.
3. On the **Settings** tab, note the **Domain**, **Client ID**, and **Client Secret**.
4. Still on **Settings**, fill in the URLs. Replace `lifts.example.com` with the production domain once step 7 sets it up; until then, the localhost entries are enough.

   | Field | Value |
   |---|---|
   | Allowed Callback URLs | `http://localhost:3000/auth/callback, https://lifts.example.com/auth/callback` |
   | Allowed Logout URLs | `http://localhost:3000, https://lifts.example.com` |
   | Allowed Web Origins | `http://localhost:3000, https://lifts.example.com` |

5. Select **Save**.

## 2. Fill in `.env.local`

```sh
AUTH0_DOMAIN=dev-abc123.us.auth0.com   # the Domain, without https://
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_SECRET=...                       # openssl rand -hex 32
APP_BASE_URL=http://localhost:3000
```

`AUTH0_SECRET` encrypts the session cookie, and it's yours to generate: run `openssl rand -hex 32` (Git Bash has `openssl` on Windows), or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Each environment can have its own; production needs its own long-lived one.

Open the app at exactly `APP_BASE_URL`: `http://localhost:3000`, not `127.0.0.1:3000`. Otherwise the login cookie is set on a different host, and the callback fails with a state mismatch.

Without these variables the app still runs, but everyone is signed out, and `/auth/login` answers "Sign-in isn't set up".

## 3. Create the organizer role

1. Go to **User Management → Roles → Create Role**.
2. Name it exactly `organizer` (lowercase). Description: `Reviews flagged awards and manages teams in Lifts.`
3. Select **Create**. The role needs no permissions; Lifts only checks its name.

## 4. Add the roles to the ID token

Auth0 doesn't put roles in tokens by default. A post-login Action adds them under the claim `https://lifts.app/roles`.

1. Go to **Actions → Library → Create Action → Build from scratch**.
2. Name it `Add roles to ID token`, choose the **Login / Post Login** trigger and the recommended runtime, then select **Create**.
3. Replace the code with:

   ```js
   exports.onExecutePostLogin = async (event, api) => {
     api.idToken.setCustomClaim("https://lifts.app/roles", event.authorization?.roles ?? []);
   };
   ```

4. Select **Deploy**.
5. Go to **Actions → Triggers → post-login**. Drag `Add roles to ID token` from the **Custom** tab into the flow between **Start** and **Complete**, then select **Apply**.

Deploying alone doesn't run the Action; it has to be in the post-login flow.

## 5. Make someone an organizer

1. Start the app (`npm run dev`), open http://localhost:3000, and select **Log in**. Sign up or sign in once, so Auth0 has a user to assign the role to.
2. In the dashboard, go to **User Management → Users**, open that user, and select the **Roles** tab.
3. Select **Assign Roles**, choose `organizer`, and select **Assign**.
4. In Lifts, select **Log out**, then **Log in** again.

Roles are read from the ID token, which is issued at sign-in. After any role change, the person has to log out and back in before Lifts sees it.

Until Hack the Hill's organizers opt in, our team members are the organizers.

## 6. Check it works

- Signed in as an organizer, the header shows **Review queue** and **Teams**, and http://localhost:3000/api/me returns `"roles": ["organizer"]`.
- Signed in as anyone else, those links are missing, `/organizer/teams` says only organizers can see it, and the organizer API routes return 403.
- A participant with no team is sent to `/join`. The invite codes come from `npm run db:seed` locally, or from **Teams → Issue invite code**.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Callback URL mismatch" on the Auth0 page | Add the exact `/auth/callback` URL to **Allowed Callback URLs**. |
| "Sign-in isn't set up" | One of the four `AUTH0_*` variables is missing from `.env.local`. Restart `npm run dev` after editing it. |
| State mismatch or "invalid state" after logging in | You opened a different host than `APP_BASE_URL` (for example `127.0.0.1` instead of `localhost`). |
| `roles` is empty for an organizer | The Action isn't in the post-login flow, the role name isn't exactly `organizer`, or the person hasn't logged out and back in since the change. |
| Logout lands on an Auth0 error page | Add the app's base URL to **Allowed Logout URLs**. |
