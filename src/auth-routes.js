const express = require('express');
const router = express.Router();
const chalk = require('chalk');
// open is an ESM module, not needed in auth-routes

class AuthRoutes {
  constructor(authManager) {
    this.authManager = authManager;
    this.pendingAuthResolve = null;
    this.pendingAuthReject = null;
  }

  setupRoutes() {
    // Landing page for authentication
    router.get('/auth', async (req, res) => {
      try {
        if (await this.authManager.isAuthenticated()) {
          const minutesRemaining = Math.floor((this.authManager.tokenExpiresAt - Date.now()) / 60000);
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Power Pages Auth - Already Authenticated</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
                .success { color: #28a745; }
                .info { background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
                button { background: #007bff; color: white; border: none; padding: 10px 20px; 
                         border-radius: 5px; cursor: pointer; margin: 5px; }
                button:hover { background: #0056b3; }
                .warning { background: #ffc107; color: #333; padding: 10px; border-radius: 5px; }
              </style>
            </head>
            <body>
              <h1 class="success">✅ Already Authenticated</h1>
              <div class="info">
                <p>Your authentication token is valid for approximately <strong>${minutesRemaining} minutes</strong>.</p>
                <p>The server is using this token to make API calls to your Power Pages environment.</p>
              </div>
              <div>
                <button onclick="window.location.href='/auth/refresh'">Refresh Token</button>
                <button onclick="window.location.href='/auth/logout'">Clear Authentication</button>
                <button onclick="window.close()">Close Window</button>
              </div>
            </body>
            </html>
          `);
        } else {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Power Pages Auth - Login Required</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
                h1 { color: #333; }
                .info { background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
                button { background: #007bff; color: white; border: none; padding: 12px 24px; 
                         border-radius: 5px; cursor: pointer; font-size: 16px; }
                button:hover { background: #0056b3; }
                .steps { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .steps li { margin: 10px 0; }
              </style>
            </head>
            <body>
              <h1>🔐 Power Pages Authentication</h1>
              <div class="info">
                <p>You need to authenticate with Microsoft to access Power Pages APIs.</p>
                <p>This will provide a token valid for approximately 3 hours.</p>
              </div>
              <div class="steps">
                <h3>What will happen:</h3>
                <ol>
                  <li>Click the button below to start authentication</li>
                  <li>You'll be redirected to Microsoft login</li>
                  <li>Sign in with your Power Pages account</li>
                  <li>Grant permissions if prompted</li>
                  <li>You'll be redirected back here</li>
                </ol>
              </div>
              <button onclick="window.location.href='/auth/login'">
                🚀 Authenticate with Microsoft
              </button>
            </body>
            </html>
          `);
        }
      } catch (error) {
        console.error(chalk.red('❌ Auth page error:'), error);
        res.status(500).send('Authentication service error');
      }
    });

    // Initiate login
    router.get('/auth/login', async (req, res) => {
      try {
        if (!this.authManager.isConfigured()) {
          res.status(503).send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Configuration Required</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
                .error { color: #dc3545; }
                .code { background: #f4f4f4; padding: 10px; border-radius: 3px; font-family: monospace; }
              </style>
            </head>
            <body>
              <h1 class="error">❌ OAuth2 Not Configured</h1>
              <p>OAuth2 authentication has not been configured yet.</p>
              <p>Please run the following command in your terminal:</p>
              <div class="code">npm run auth-setup</div>
              <p>Then edit the generated configuration file with your Azure AD app details.</p>
            </body>
            </html>
          `);
          return;
        }

        // Store a promise that will be resolved when auth completes
        const authPromise = new Promise((resolve, reject) => {
          this.pendingAuthResolve = resolve;
          this.pendingAuthReject = reject;
        });

        // Start interactive authentication
        this.authManager.authenticateInteractive()
          .then(result => {
            if (this.pendingAuthResolve) {
              this.pendingAuthResolve(result);
            }
          })
          .catch(error => {
            if (this.pendingAuthReject) {
              this.pendingAuthReject(error);
            }
          });

        // Send a waiting page
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authenticating...</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
              .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #007bff; 
                        border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;
                        margin: 20px auto; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              .info { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
            <script>
              // Check authentication status periodically
              setInterval(() => {
                fetch('/auth/status')
                  .then(res => res.json())
                  .then(data => {
                    if (data.authenticated) {
                      window.location.href = '/auth/success';
                    }
                  });
              }, 2000);
            </script>
          </head>
          <body>
            <h1>🔄 Authenticating with Microsoft...</h1>
            <div class="spinner"></div>
            <div class="info">
              <p>A new window should open for Microsoft authentication.</p>
              <p>If it doesn't, check your terminal for the authentication link.</p>
              <p>Complete the authentication in the Microsoft window.</p>
            </div>
          </body>
          </html>
        `);
      } catch (error) {
        console.error(chalk.red('❌ Login initiation error:'), error);
        res.status(500).send('Failed to initiate login');
      }
    });

    // OAuth2 callback endpoint
    router.get('/auth/callback', async (req, res) => {
      try {
        const { code, state, error, error_description } = req.query;

        if (error) {
          console.error(chalk.red('❌ Auth callback error:'), error, error_description);
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Authentication Failed</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
                .error { color: #dc3545; }
              </style>
            </head>
            <body>
              <h1 class="error">❌ Authentication Failed</h1>
              <p>Error: ${error}</p>
              <p>${error_description || ''}</p>
              <button onclick="window.location.href='/auth'">Try Again</button>
            </body>
            </html>
          `);
          return;
        }

        if (code) {
          // Exchange authorization code for token
          console.log(chalk.blue('🔄 Exchanging authorization code for token...'));
          
          // Note: This would need to be implemented with MSAL's acquireTokenByCode
          // For now, we'll show a success message
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Authentication Successful</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
                .success { color: #28a745; }
                .code { background: #f4f4f4; padding: 10px; border-radius: 3px; font-family: monospace; }
              </style>
              <script>
                setTimeout(() => { window.location.href = '/auth/success'; }, 2000);
              </script>
            </head>
            <body>
              <h1 class="success">✅ Authentication Code Received</h1>
              <p>Exchanging code for access token...</p>
              <div class="code">${code.substring(0, 20)}...</div>
            </body>
            </html>
          `);
        } else {
          res.status(400).send('No authorization code received');
        }
      } catch (error) {
        console.error(chalk.red('❌ Callback error:'), error);
        res.status(500).send('Authentication callback failed');
      }
    });

    // Success page
    router.get('/auth/success', async (req, res) => {
      const isAuth = await this.authManager.isAuthenticated();
      if (isAuth) {
        const hoursValid = Math.floor((this.authManager.tokenExpiresAt - Date.now()) / 3600000);
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authentication Successful</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
              .success { color: #28a745; }
              .info { background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; }
              button { background: #28a745; color: white; border: none; padding: 10px 20px; 
                       border-radius: 5px; cursor: pointer; }
              button:hover { background: #218838; }
            </style>
            <script>
              setTimeout(() => { 
                if (window.opener) {
                  window.close();
                }
              }, 5000);
            </script>
          </head>
          <body>
            <h1 class="success">✅ Authentication Successful!</h1>
            <div class="info">
              <p>Your authentication token is valid for approximately <strong>${hoursValid} hours</strong>.</p>
              <p>The Power Pages local server can now make authenticated API calls.</p>
              <p>This window will close automatically in 5 seconds...</p>
            </div>
            <button onclick="window.close()">Close Now</button>
          </body>
          </html>
        `);
      } else {
        res.redirect('/auth');
      }
    });

    // Check authentication status (JSON endpoint)
    router.get('/auth/status', async (req, res) => {
      try {
        const isAuth = await this.authManager.isAuthenticated();
        const response = {
          authenticated: isAuth,
          configured: this.authManager.isConfigured()
        };
        
        if (isAuth && this.authManager.tokenExpiresAt) {
          response.expiresIn = Math.floor((this.authManager.tokenExpiresAt - Date.now()) / 1000);
          response.expiresAt = new Date(this.authManager.tokenExpiresAt).toISOString();
        }
        
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: 'Failed to check auth status' });
      }
    });

    // Refresh token
    router.get('/auth/refresh', async (req, res) => {
      try {
        console.log(chalk.blue('🔄 Attempting to refresh token...'));
        const result = await this.authManager.acquireTokenSilent();
        
        if (result) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Token Refreshed</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
                .success { color: #28a745; }
              </style>
            </head>
            <body>
              <h1 class="success">✅ Token Refreshed Successfully</h1>
              <p>Your authentication token has been refreshed.</p>
              <button onclick="window.location.href='/auth'">Back to Auth Status</button>
            </body>
            </html>
          `);
        } else {
          res.redirect('/auth/login');
        }
      } catch (error) {
        console.error(chalk.red('❌ Token refresh error:'), error);
        res.redirect('/auth/login');
      }
    });

    // Logout / clear authentication
    router.get('/auth/logout', async (req, res) => {
      try {
        await this.authManager.clearTokenCache();
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Logged Out</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
              .info { background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <h1>👋 Logged Out</h1>
            <div class="info">
              <p>Your authentication token has been cleared.</p>
              <p>You'll need to authenticate again to make API calls.</p>
            </div>
            <button onclick="window.location.href='/auth'">Back to Auth Page</button>
          </body>
          </html>
        `);
      } catch (error) {
        console.error(chalk.red('❌ Logout error:'), error);
        res.status(500).send('Failed to logout');
      }
    });

    return router;
  }
}

module.exports = AuthRoutes;
