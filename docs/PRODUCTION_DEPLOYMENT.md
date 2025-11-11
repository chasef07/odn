# Production Deployment Guide

Complete checklist for deploying OnlineDoctorNote to production.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Stripe Configuration](#stripe-configuration)
- [Email Configuration](#email-configuration)
- [Vercel Deployment](#vercel-deployment)
- [Post-Deployment Verification](#post-deployment-verification)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Security Checklist](#security-checklist)
- [Rollback Procedure](#rollback-procedure)
- [Common Issues](#common-issues)

## Pre-Deployment Checklist

### Code Quality

- [ ] All tests passing (249 tests)
  ```bash
  npm test
  ```

- [ ] No TypeScript errors
  ```bash
  npm run build
  ```

- [ ] No ESLint warnings
  ```bash
  npm run lint
  ```

- [ ] All dependencies up to date
  ```bash
  npm outdated
  ```

### Feature Completeness

- [ ] Multi-step form working end-to-end
- [ ] Payment flow tested with Stripe test cards
- [ ] Admin portal login functional
- [ ] Approval flow generates PDF correctly
- [ ] Denial flow processes refunds correctly
- [ ] Email templates rendering properly
- [ ] Form validation working on all steps
- [ ] Mobile responsive design verified

### Documentation

- [ ] README.md updated with production info
- [ ] CLAUDE.md updated with recent changes
- [ ] Environment variables documented in `.env.example`
- [ ] API documentation current
- [ ] This deployment guide reviewed

## Environment Configuration

### Required Environment Variables

Create these in your hosting platform (Vercel, AWS, etc.):

#### Site Configuration

```env
NEXT_PUBLIC_SITE_URL=https://onlinedoctornote.com
NODE_ENV=production
```

**Critical**: Update this from localhost to your production domain!

#### Stripe Configuration (Production Keys)

```env
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_PAYMENT_AMOUNT=2495
```

**Important**:
- Switch from test keys (`sk_test_`, `pk_test_`) to live keys (`sk_live_`, `pk_live_`)
- Update webhook secret after configuring production webhooks
- Verify payment amount is correct ($24.95 = 2495 cents)

#### Database Configuration

```env
DATABASE_URL=postgresql://user:password@host:5432/database
PRISMA_DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=your_api_key
```

**Note**: These should point to your production PostgreSQL database, not development.

#### Better Auth Configuration

```env
BETTER_AUTH_SECRET=<generate-new-secret>
BETTER_AUTH_URL=https://onlinedoctornote.com
```

**Generate new secret:**
```bash
openssl rand -base64 32
```

**Critical**: Update BETTER_AUTH_URL to production domain!

#### Email Configuration (Resend)

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@onlinedoctornote.com
```

**Verify**:
- Resend API key is for production workspace
- From email domain is verified in Resend
- SPF/DKIM records configured for domain

#### Doctor Information

```env
DOCTOR_NAME="Dr. Jason Buchwald"
DOCTOR_CREDENTIALS="MD"
DOCTOR_LICENSE_NUMBER="1558307702"
DOCTOR_SIGNATURE_URL="/images/doctor-signature.png"
```

**Verify**:
- Doctor information is accurate
- Signature image exists in `public/images/`

#### Cron Job Security

```env
CRON_SECRET=<generate-new-secret>
```

**Generate new secret:**
```bash
openssl rand -hex 32
```

### Environment Variable Checklist

- [ ] All variables set in production environment
- [ ] No test/development values in production
- [ ] Secrets are newly generated (not copied from dev)
- [ ] URLs updated to production domain
- [ ] All secrets stored securely (not in git)

## Database Setup

### Production Database

1. **Create PostgreSQL Database**
   - Use Prisma Cloud, Supabase, AWS RDS, or similar
   - Ensure database is accessible from your hosting platform
   - Note connection string for `DATABASE_URL`

2. **Set Up Prisma Accelerate** (Optional but recommended)
   - Go to https://cloud.prisma.io/
   - Create new project
   - Enable Accelerate
   - Copy connection string for `PRISMA_DATABASE_URL`

3. **Run Migrations**
   ```bash
   # From your local machine with production DATABASE_URL set
   npx prisma migrate deploy
   ```

   Or if using Vercel:
   ```bash
   # Add to your build script or run manually
   npx prisma generate
   ```

4. **Verify Schema**
   ```bash
   npx prisma studio
   ```

   Check that all tables exist:
   - User
   - Account
   - Session
   - Submission
   - TemporarySubmission
   - Verification

### Create Doctor Account

After database is set up:

```bash
# Run the doctor account creation script
npx tsx scripts/create-doctor-user.ts
```

Follow the prompts to:
1. Enter doctor's email
2. Set secure password
3. Confirm account creation

**Store credentials securely** - you'll need these to access the admin portal.

### Database Backup Strategy

- [ ] Set up automated daily backups
- [ ] Test restore procedure
- [ ] Document backup retention policy
- [ ] Set up monitoring for backup failures

## Stripe Configuration

### Switch to Production Mode

1. **Get Live API Keys**
   - Go to https://dashboard.stripe.com/apikeys
   - Switch to "Live mode" toggle
   - Copy Secret key (starts with `sk_live_`)
   - Copy Publishable key (starts with `pk_live_`)

2. **Update Environment Variables**
   - Replace `STRIPE_SECRET_KEY` with live key
   - Replace `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` with live key

### Configure Webhooks

1. **Create Production Webhook**
   - Go to https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://onlinedoctornote.com/api/webhooks/stripe`
   - Description: "Production - Payment succeeded"

2. **Select Events**
   - ✅ `payment_intent.succeeded`
   - ✅ `charge.refunded` (optional - for monitoring)

3. **Get Signing Secret**
   - After creating webhook, reveal signing secret
   - Update `STRIPE_WEBHOOK_SECRET` in environment variables
   - Starts with `whsec_`

4. **Test Webhook**
   - Stripe provides "Send test webhook" option
   - Verify your endpoint receives and processes event
   - Check logs for any errors

### Stripe Dashboard Configuration

- [ ] Business information completed
- [ ] Bank account connected for payouts
- [ ] Tax settings configured
- [ ] Email receipts enabled
- [ ] Statement descriptor set ("ONLINEDOCTORNOTE" or similar)
- [ ] Radar rules reviewed (fraud prevention)

### Test Payment Flow

Before going live, test with Stripe test cards:

- [ ] Successful payment: `4242 4242 4242 4242`
- [ ] Declined payment: `4000 0000 0000 0002`
- [ ] Verify webhook is triggered
- [ ] Check submission created in database
- [ ] Test refund flow from admin portal

## Email Configuration

### Resend Setup

1. **Verify Domain**
   - Go to https://resend.com/domains
   - Add your domain (onlinedoctornote.com)
   - Add DNS records (SPF, DKIM, DMARC)
   - Wait for verification (can take 24-48 hours)

2. **Create API Key**
   - Go to https://resend.com/api-keys
   - Create new API key for production
   - Update `RESEND_API_KEY` environment variable

3. **Configure From Email**
   - Ensure `RESEND_FROM_EMAIL` uses verified domain
   - Example: `noreply@onlinedoctornote.com`

### Email Template Testing

- [ ] Preview approval email: `npm run email`
- [ ] Preview denial email: `npm run email`
- [ ] Send test approval email
- [ ] Send test denial email
- [ ] Verify PDF attachment in approval email
- [ ] Check email rendering in multiple clients
  - Gmail
  - Outlook
  - Apple Mail
  - Mobile devices

### DNS Records Checklist

- [ ] SPF record added
- [ ] DKIM record added
- [ ] DMARC policy configured
- [ ] All records verified in Resend dashboard
- [ ] Test email delivery with https://www.mail-tester.com/

## Vercel Deployment

### Initial Setup

1. **Connect Repository**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Select `main` branch for production

2. **Configure Project**
   - Framework Preset: Next.js
   - Root Directory: `./` (leave as default)
   - Build Command: `npm run build`
   - Output Directory: `.next` (leave as default)

3. **Add Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all production environment variables listed above
   - Set environment scope to "Production"

4. **Domain Configuration**
   - Go to Project Settings → Domains
   - Add custom domain: `onlinedoctornote.com`
   - Add `www.onlinedoctornote.com` (redirects to primary)
   - Configure DNS records as instructed by Vercel

### Build Configuration

Ensure `vercel.json` is configured (create if not exists):

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

### Deployment Steps

1. **Trigger Initial Deployment**
   - Push to `main` branch or click "Deploy" in Vercel
   - Wait for build to complete
   - Check deployment logs for errors

2. **Verify Build Success**
   - [ ] Build completes without errors
   - [ ] No TypeScript compilation errors
   - [ ] All routes generated correctly
   - [ ] Static files copied to output

3. **Run Prisma Generation**
   - Vercel automatically runs `prisma generate` during build
   - Verify in build logs: "✓ Generated Prisma Client"

### Vercel Settings

- [ ] **Automatic Deployments**: Enabled for `main` branch
- [ ] **Preview Deployments**: Enabled for pull requests
- [ ] **Environment Variables**: All production vars set
- [ ] **Custom Domain**: Configured and SSL active
- [ ] **Analytics**: Enabled (already integrated in code)
- [ ] **Function Regions**: Set to closest to database
- [ ] **Cron Jobs**: Configured for cleanup

### Cron Jobs (Vercel)

Configure in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-temp-submissions",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This runs the cleanup job daily at 2 AM UTC.

**Authorization**: Cron requests include `x-vercel-cron` header and require `CRON_SECRET` bearer token.

## Post-Deployment Verification

### Smoke Tests

#### Public Pages

- [ ] Homepage loads: https://onlinedoctornote.com
- [ ] Start page loads: https://onlinedoctornote.com/start
- [ ] Privacy policy loads: https://onlinedoctornote.com/privacy-policy
- [ ] Terms of service loads: https://onlinedoctornote.com/terms-of-service

#### SEO Files

- [ ] Robots.txt: https://onlinedoctornote.com/robots.txt
- [ ] Sitemap: https://onlinedoctornote.com/sitemap.xml
- [ ] AI instructions: https://onlinedoctornote.com/llms-full.txt

#### Form Flow

- [ ] State selection works
- [ ] All form steps navigate correctly
- [ ] Validation errors display properly
- [ ] Progress tracking accurate
- [ ] Form data persists in localStorage
- [ ] Review page shows all data correctly

#### Payment Flow

**⚠️ Use a real credit card for testing (you'll refund it)**

- [ ] Create payment intent succeeds
- [ ] Stripe Elements loads correctly
- [ ] Payment processes successfully
- [ ] Webhook receives payment event
- [ ] Submission created in database
- [ ] Redirect to success page
- [ ] Check submission appears in admin portal

#### Admin Portal

- [ ] Login page loads: https://onlinedoctornote.com/admin/login
- [ ] Doctor can log in with credentials
- [ ] Dashboard shows submissions
- [ ] Approve submission:
  - [ ] PDF generates correctly
  - [ ] Approval email sends with PDF attached
  - [ ] Submission status updates to "approved"
- [ ] Deny submission:
  - [ ] Refund processes in Stripe
  - [ ] Denial email sends
  - [ ] Submission status updates to "denied"
- [ ] Monthly limit warning displays when applicable

#### Email Delivery

- [ ] Approval emails arrive within seconds
- [ ] Denial emails arrive within seconds
- [ ] PDF attachment opens correctly
- [ ] Email formatting looks good
- [ ] Links work correctly
- [ ] From address is correct

### Performance Testing

- [ ] **PageSpeed Insights**
  - Run: https://pagespeed.web.dev/
  - Target: 90+ on mobile and desktop
  - Check Core Web Vitals (LCP, FID, CLS)

- [ ] **Load Testing**
  - Test with multiple concurrent users
  - Verify API response times <500ms
  - Check database connection pooling

- [ ] **Mobile Testing**
  - Test on real iOS device
  - Test on real Android device
  - Verify touch targets are adequate
  - Check form inputs on mobile keyboard

### Security Testing

- [ ] SSL certificate active (HTTPS)
- [ ] No console errors in browser
- [ ] No exposed secrets in client-side code
- [ ] CORS configured correctly
- [ ] Webhook signature verification working
- [ ] Admin routes require authentication
- [ ] Form validation prevents XSS
- [ ] Rate limiting considered (not implemented yet)

## Monitoring & Maintenance

### Set Up Monitoring

1. **Vercel Analytics**
   - Already integrated in code
   - Check: Project → Analytics tab
   - Monitor page views and web vitals

2. **Stripe Dashboard**
   - Monitor successful payments
   - Set up alerts for failed payments
   - Watch for chargebacks or disputes

3. **Database Monitoring**
   - Set up alerts for high connection count
   - Monitor query performance
   - Track storage usage

4. **Email Delivery**
   - Resend dashboard for delivery stats
   - Monitor bounce rates
   - Check spam complaints

5. **Uptime Monitoring** (Optional)
   - Use service like UptimeRobot or Pingdom
   - Monitor homepage availability
   - Set up alerts for downtime

### Health Check Endpoints

Consider adding these endpoints for monitoring:

```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
}
```

### Log Aggregation

Vercel provides automatic logging:
- Go to Project → Logs
- Filter by function, status code, or time
- Set up alerts for errors

### Backup Schedule

- [ ] **Database**: Daily automated backups
- [ ] **Environment Variables**: Store securely offline
- [ ] **Doctor Credentials**: Documented and stored securely
- [ ] **Stripe Keys**: Backup in secure password manager

## Security Checklist

### Pre-Deployment Security

- [ ] All environment variables use strong secrets
- [ ] No hardcoded secrets in code
- [ ] `.env.local` in `.gitignore`
- [ ] Dependencies updated to latest secure versions
- [ ] Known vulnerabilities fixed: `npm audit`

### Authentication Security

- [ ] Better Auth configured correctly
- [ ] Passwords hashed with bcrypt (10 rounds)
- [ ] Session secrets are unique and strong
- [ ] Session timeout configured appropriately
- [ ] HTTPS enforced for all auth requests

### Payment Security

- [ ] Stripe webhook signatures verified
- [ ] Payment amounts validated server-side
- [ ] No client-side payment amount manipulation possible
- [ ] PCI compliance maintained (Stripe handles this)

### Data Security

- [ ] Patient data encrypted in transit (HTTPS)
- [ ] Database uses SSL connection
- [ ] No sensitive data logged
- [ ] Admin access restricted to authenticated users
- [ ] Temporary submissions cleaned up automatically

### HIPAA Considerations

**Note**: This application collects health information. Consider:

- [ ] Business Associate Agreement (BAA) with hosting provider
- [ ] BAA with Stripe if processing PHI
- [ ] BAA with email provider (Resend)
- [ ] Privacy policy covers HIPAA requirements
- [ ] Terms of service include proper disclosures

**Consult with legal counsel** before claiming HIPAA compliance.

## Rollback Procedure

If issues arise after deployment:

### Vercel Rollback

1. Go to Project → Deployments
2. Find last known good deployment
3. Click three dots → "Promote to Production"
4. Confirm promotion

**This reverts your application to the previous version immediately.**

### Database Rollback

If database migrations cause issues:

1. **Restore from backup**
   ```bash
   # Restore database from backup
   pg_restore -d production_db backup_file.dump
   ```

2. **Revert migrations** (if needed)
   ```bash
   # This is complex - prefer restoring from backup
   npx prisma migrate resolve --rolled-back migration_name
   ```

### Stripe Rollback

If webhook configuration breaks:

1. Go to Stripe Dashboard → Webhooks
2. Disable the problematic webhook
3. Roll back application
4. Re-test and re-enable webhook

### Communication

If rollback is needed:

- [ ] Post status update (if you have status page)
- [ ] Email affected customers (if any)
- [ ] Document what went wrong
- [ ] Create post-mortem
- [ ] Implement fixes before redeployment

## Common Issues

### Issue: Build Fails

**Symptoms**: Vercel build fails with TypeScript errors

**Solutions**:
1. Run `npm run build` locally
2. Fix any TypeScript errors
3. Ensure all dependencies are in `package.json`
4. Check Node.js version matches Vercel (18+)

### Issue: Environment Variables Not Working

**Symptoms**: App works locally but fails in production

**Solutions**:
1. Verify all env vars set in Vercel dashboard
2. Check for typos in variable names
3. Redeploy after adding variables
4. Check variable scope (Production/Preview/Development)

### Issue: Database Connection Fails

**Symptoms**: Can't connect to database from Vercel

**Solutions**:
1. Verify `DATABASE_URL` is correct
2. Check database allows connections from Vercel IPs
3. Ensure SSL is configured if required
4. Test connection with Prisma Studio locally

### Issue: Stripe Webhooks Not Working

**Symptoms**: Payments succeed but submissions not created

**Solutions**:
1. Check webhook endpoint URL is correct
2. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
3. Check Vercel function logs for errors
4. Test webhook with Stripe CLI
5. Ensure webhook is enabled in Stripe dashboard

### Issue: Emails Not Sending

**Symptoms**: Approval/denial emails don't arrive

**Solutions**:
1. Verify Resend domain is verified
2. Check `RESEND_API_KEY` is correct
3. Verify `RESEND_FROM_EMAIL` uses verified domain
4. Check Resend dashboard for error logs
5. Test with simple email first (no attachments)

### Issue: PDF Generation Fails

**Symptoms**: Approval fails with PDF error

**Solutions**:
1. Check doctor signature image exists
2. Verify doctor environment variables are set
3. Test PDF generation locally: `npx tsx scripts/test-approval-flow.ts`
4. Check Vercel function logs for specific error
5. Ensure @react-pdf/renderer is in dependencies

### Issue: Admin Portal Login Fails

**Symptoms**: Can't log into admin portal

**Solutions**:
1. Verify doctor account was created
2. Check `BETTER_AUTH_SECRET` is set
3. Verify `BETTER_AUTH_URL` matches production domain
4. Reset password with `npx tsx scripts/update-doctor-password.ts`
5. Check database for User record

### Issue: Forms Not Submitting

**Symptoms**: Payment page doesn't load or form errors

**Solutions**:
1. Check browser console for JavaScript errors
2. Verify Stripe publishable key is correct
3. Test localStorage is working (not blocked)
4. Check form validation is passing
5. Verify API routes are accessible

## Post-Deployment Tasks

### Day 1

- [ ] Complete all post-deployment verification steps above
- [ ] Monitor error logs for first few hours
- [ ] Test full user flow multiple times
- [ ] Set up monitoring alerts

### Week 1

- [ ] Submit sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Monitor payment success rate
- [ ] Review first customer submissions
- [ ] Check email delivery rates
- [ ] Verify admin workflow is smooth

### Month 1

- [ ] Review analytics data
- [ ] Check for any error patterns
- [ ] Optimize based on user behavior
- [ ] Collect customer feedback
- [ ] Review security logs
- [ ] Update documentation based on learnings

## Support & Troubleshooting

### Get Help

1. **Check this guide** for common issues
2. **Review application logs** in Vercel
3. **Check Stripe dashboard** for payment issues
4. **Review Resend dashboard** for email issues
5. **Test locally** to isolate production-specific issues

### Documentation

- **Application**: README.md, CLAUDE.md
- **Testing**: TESTING.md
- **SEO**: docs/SEO_GUIDE.md
- **Stripe**: docs/STRIPE_MIGRATION_GUIDE.md

### External Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **Prisma Documentation**: https://www.prisma.io/docs
- **Stripe Documentation**: https://stripe.com/docs
- **Resend Documentation**: https://resend.com/docs
- **Better Auth Documentation**: https://www.better-auth.com/docs

## Success Criteria

Your deployment is successful when:

- ✅ All smoke tests pass
- ✅ Payment flow works end-to-end
- ✅ Admin portal is functional
- ✅ Emails deliver successfully
- ✅ PDFs generate correctly
- ✅ No critical errors in logs
- ✅ Performance metrics meet targets
- ✅ Security checklist complete
- ✅ Monitoring is active
- ✅ SEO files are accessible

## Final Checklist

Before announcing launch:

- [ ] All verification steps completed
- [ ] At least 3 successful test transactions (refunded)
- [ ] Admin approval workflow tested
- [ ] Admin denial workflow tested
- [ ] Email templates rendering correctly
- [ ] SEO setup complete (sitemap submitted)
- [ ] Monitoring and alerts configured
- [ ] Backup strategy in place
- [ ] Support email configured and monitored
- [ ] Documentation up to date

**Congratulations on your deployment! 🚀**

---

For questions or issues, refer to README.md or contact the development team.
