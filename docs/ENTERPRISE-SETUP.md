# Enterprise Setup

The Murderer's Lock Enterprise tier includes SSO/SAML, compliance features, and dedicated support.

## SSO/SAML

Enterprise customers can integrate with their identity provider (Okta, Azure AD, Google Workspace, etc.) for single sign-on.

### Configuration

1. **IdP Setup**: Configure your SAML 2.0 IdP with:
   - ACS URL: `https://your-domain.com/api/enterprise-auth`
   - Entity ID: `https://murdererslock.com/enterprise`
   - Attributes: email, name (optional)

2. **Contact Sales**: Provide your IdP metadata XML to enterprise@murdererslock.com for tenant configuration.

3. **User Mapping**: Users authenticate via IdP; vault access is mapped by email or SAML attributes.

### Placeholder

The `/api/enterprise-auth` endpoint is a placeholder. Full SAML integration requires:
- SAML response parsing and validation
- Session/JWT issuance
- Vault-to-user mapping in database

## Compliance

- **Audit logs**: All vault actions logged to `audit_log` (Supabase)
- **Retention**: Configurable per tenant (default 90 days)
- **Export**: CSV/JSON export via API (contact for access)

## Contact

For Enterprise pricing and setup: enterprise@murdererslock.com
