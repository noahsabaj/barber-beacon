# Vercel Environment Variables Setup Guide

## Required Environment Variables

These **MUST** be configured in Vercel for the app to work:

### 1. DATABASE_URL (Required)
```
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
```
- Get this from Supabase, Neon, or your PostgreSQL provider
- Must include `?sslmode=require` for production databases

### 2. JWT_SECRET (Required)
```
JWT_SECRET="your-super-secret-jwt-key-replace-this"
```
- Generate a secure random string (at least 32 characters)
- You can generate one with: `openssl rand -base64 32`

## How to Add Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project (`barber-beacon`)
3. Click on "Settings" tab
4. Navigate to "Environment Variables" in the left sidebar
5. Add each variable:
   - Key: `DATABASE_URL`
   - Value: Your database connection string
   - Environment: ✅ Production, ✅ Preview, ✅ Development
6. Repeat for `JWT_SECRET`
7. Click "Save"

## Optional But Recommended Variables

### Email Service (SendGrid)
```
SENDGRID_API_KEY="SG.xxxxxxxxxxxxxxxxxxxxx"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"
```

### SMS Service (Twilio)
```
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_PHONE_NUMBER="+1234567890"
```

### Payment Processing (Stripe)
```
STRIPE_SECRET_KEY="your_stripe_secret_key_here"
STRIPE_PUBLISHABLE_KEY="your_stripe_publishable_key_here"
STRIPE_WEBHOOK_SECRET="your_stripe_webhook_secret_here"
```

## Troubleshooting

### Error: "Database connection failed"
- Check that DATABASE_URL is set correctly
- Verify the connection string includes `?sslmode=require`
- Ensure your database is accessible from Vercel's servers

### Error: "[object Object]" in UI
- This was a bug that's now fixed in the latest deployment
- If you still see this, check Vercel logs for specific error details

### Checking Logs
1. Go to Vercel dashboard
2. Click on your project
3. Navigate to "Functions" tab
4. Click on any failing function to see logs

## Testing Your Configuration

After setting environment variables:
1. Trigger a new deployment (push any commit or click "Redeploy")
2. Visit your site and try registering a new account
3. Check the Functions logs if you encounter errors

## Security Notes

- Never commit `.env` files to Git
- Use different values for production vs development
- Rotate JWT_SECRET periodically
- Use strong, unique passwords for database connections