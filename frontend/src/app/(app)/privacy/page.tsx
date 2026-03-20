export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12">
      <h1 className="text-2xl font-heading font-bold mb-6">Privacy Policy</h1>
      <div className="text-sm text-muted-foreground space-y-4">
        <p>FinancePulse collects minimal personal data: your email address and password (hashed) when you create an account.</p>
        <p>Your portfolio data, watchlists, and alerts are stored in our database and are only accessible to you.</p>
        <p>We do not sell or share your personal data with third parties.</p>
        <p>Market data requests are made to third-party APIs on your behalf. We do not log your browsing activity or search history.</p>
        <p>You can delete your account and all associated data at any time from the Settings page.</p>
      </div>
    </div>
  );
}
