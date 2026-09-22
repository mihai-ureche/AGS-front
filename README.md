# AGS Insights

A responsive sales workspace built with React, TypeScript, Vite, Ionic React, and Capacitor. Includes Microsoft sign-in, sales charts, period comparisons, searchable orders, product/customer reporting, and CSV export.

**Sales data is currently sample data, including after Microsoft sign-in.** Authentication is wired to Microsoft Entra; you must supply an app registration before real sign-in can work. No backend or real sales integration is included.

## Run locally

Use Node.js 22.12+ (the repository pins the Node 22 line).

```bash
npm ci
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>. Select **Explore the demo** to try the workspace without credentials. Demo sessions live in memory and end on refresh. Set `VITE_ENABLE_DEMO=false` to hide demo access. All `VITE_` values are public build-time configuration, so never put secrets in them.

## Microsoft sign-in on the web

1. In [Microsoft Entra app registrations](https://entra.microsoft.com/), create an application. For an internal business app, choose accounts in your organization only.
2. Under **Authentication → Add a platform → Single-page application**, register `http://localhost:5173/` and your exact production URL, such as `https://ags-insights.onrender.com/`. Include the trailing slash. For local production preview, also register `http://localhost:4173/` if you intend to sign in there.
3. Copy **Application (client) ID** and **Directory (tenant) ID** into `.env`:

   ```dotenv
   VITE_MICROSOFT_CLIENT_ID=your-application-client-id
   VITE_MICROSOFT_TENANT_ID=your-directory-tenant-id
   ```

4. Restart Vite. Choose **Continue with Microsoft**.

Web sign-in uses MSAL authorization code flow with PKCE and session storage. The redirect defaults to the current origin plus `/`; `VITE_MICROSOFT_REDIRECT_URI` can override it. Do not create a client secret or enable implicit token grants for this SPA. The app uses organizational accounts by default; broader account audiences also require matching Entra registration settings.

Sign-out on web redirects through Microsoft. Actual tenant consent policies and organizational access must be tested with your account. Browser UI access is not an API authorization boundary: a future backend must validate access tokens, audience, issuer, scopes, and roles.

## Deploy on Render

The repository includes [render.yaml](./render.yaml) for a **Render Static Site**.

1. Push the repository to your Git provider and create a Render Blueprint from it, or create a Static Site manually.
2. Use build command `npm ci && npm run build` and publish directory `dist`.
3. Add `VITE_MICROSOFT_CLIENT_ID` and `VITE_MICROSOFT_TENANT_ID` in Render. The Blueprint disables demo access with `VITE_ENABLE_DEMO=false`.
4. Register the assigned Render URL under the Entra **Single-page application** platform as described above.
5. Deploy. Rebuild after changing any `VITE_` values.

The Blueprint includes the `/*` → `/index.html` rewrite and basic response headers. The app supports deployment at the domain root. Vite generates the static assets; no Vite development server or Node web service runs in production.

## Android and iOS with Ionic / Capacitor

The same React UI is packaged into native apps using Ionic React and Capacitor. `capacitor.config.ts` points to Vite's `dist` output. Native projects are generated on demand; choose your final application ID before generating them. Capacitor 7 is used to match the native OAuth plugin's documented supported version.

### Create and open the projects

Install Android Studio and the Android SDK for Android, or Xcode and its command-line tools plus CocoaPods for iOS. Check the [Capacitor 7 environment requirements](https://capacitorjs.com/docs/v7/getting-started/environment-setup) for supported toolchain versions. iOS builds require macOS.

```bash
# Once per platform; commit the generated android/ and ios/ folders afterward.
npm run mobile:add:android
npm run mobile:add:ios

# After making web changes, rebuild, sync, and open the native IDE.
npm run mobile:android
npm run mobile:ios

# Build and synchronize without opening an IDE.
npm run mobile:sync
```

### Native Microsoft callback setup

Native sign-in uses `@capacitor-community/generic-oauth2`, the system authentication browser, authorization code + PKCE, and Microsoft Graph `/me`. It does not run MSAL Browser inside the native webview.

1. In your Entra app registration, add a **Mobile and desktop applications** platform and register the custom redirect URI `com.ags.insights://oauth/redirect`. Keep this separate from the SPA redirect URIs. Add Microsoft Graph **delegated** `User.Read` permission for the native profile request and obtain consent according to your tenant policy.
2. Set `VITE_MICROSOFT_NATIVE_REDIRECT_URI=com.ags.insights://oauth/redirect` in the environment used to build native assets (already provided in `.env.example`).
3. In generated `android/app/build.gradle`, add this inside `android.defaultConfig`:

   ```groovy
   manifestPlaceholders = [appAuthRedirectScheme: "com.ags.insights"]
   ```

4. In `android/app/src/main/res/values/strings.xml`, set `custom_url_scheme` to `com.ags.insights`. If adding a VIEW intent filter to the main activity, set its data to `<data android:scheme="@string/custom_url_scheme" android:host="oauth" />`, following the [plugin's Android setup](https://github.com/capacitor-community/generic-oauth2#platform-android). The AppAuth callback activity comes from the plugin's merged manifest.
5. In generated `ios/App/App/Info.plist`, register the callback scheme:

   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array><string>com.ags.insights</string></array>
     </dict>
   </array>
   ```

6. Run `npm run mobile:sync`, then build and test sign-in, cancellation, and callback handling on real devices. Changing the application ID or callback scheme requires updating all matching native and Entra settings.

The starter retains only the native user profile in memory and does not persist native access/refresh tokens. Native sign-out ends the app session; Microsoft SSO cookies in the system browser remain. The next sign-in shows the account selector. A future authenticated API integration needs token acquisition/renewal and appropriate secure native storage. CSV exports use a browser download on web and Capacitor's filesystem cache plus the native share sheet on Android/iOS. Include the Filesystem plugin's required Apple privacy manifest declaration when preparing an App Store release; see the [plugin documentation](https://capacitorjs.com/docs/v7/apis/filesystem).

For an existing Ionic Appflow account, connect this repository as a Capacitor application, supply the same public build environment variables, commit configured native projects, and use `npm run build` for the web build. Configure Android signing / iOS provisioning in your native CI provider. Native binaries use bundled assets and are distributed through their stores; Render serves the web app. Local Android Studio/Xcode builds work independently of Appflow.

## Checks and project layout

```bash
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

- `src/auth/AuthProvider.tsx`: web/native Microsoft sign-in and explicit demo mode.
- `src/lib/sales.ts`: deterministic sample data, reporting calculations, and CSV escaping.
- `src/App.tsx`: responsive workspace and reporting views.
- `src/styles.css`: desktop/mobile layouts and visual styles.
- `tests/app.spec.ts`: desktop and mobile browser checks.
- `render.yaml`: static deployment configuration.
- `capacitor.config.ts`, `ionic.config.json`: native application workflow.

Revenue excludes processing and refunded orders. Average order value uses completed orders only. Total orders and unique customers include all statuses. Comparisons use the immediately preceding period of equal length. Dates follow the device's local calendar. CSV export includes all orders in the selected date range, regardless of the table search/status filters. Currency is EUR.

To connect real data, replace the sample data source with an authenticated API and keep reporting calculations in `src/lib/sales.ts`. Microsoft sign-in does not provide sales data by itself. The app currently uses Google Fonts with system-font fallbacks; bundle licensed font assets locally if offline typography is required.

Reference documentation: [MSAL initialization](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/initialization), [Render static sites](https://render.com/docs/static-sites), [Capacitor workflow](https://capacitorjs.com/docs/basics/workflow), and [native OAuth plugin](https://github.com/capacitor-community/generic-oauth2).
