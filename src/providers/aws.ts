import { IProvider } from 'react-simple-auth'
import { guid } from '../services/utilities'


/*Claim	Description from Ping Documentation
iss	Issuer of the id_token 
sub	Subject of the id_token (ie the end-user’s username) 
aud	Audience for the id_token (must match the client_id of the application) 
exp	Time the id_token is set to expire (UTC, Unix Epoch time) 
iat	Timestamp when the id_token was issued (UTC, Unix Epoch time) 
auth_time	Time the end-user authenticated (UTC, Unix Epoch time) 
nonce	Nonce value supplied during the authentication request (REQUIRED for implicit flow) 
acr	Authentication context reference used to authenticate the user 
at_hash	Hash of the OAuth2 access token when used with Implicit profile 
c_hash	Hash of the OAuth2 authorization code when used with the hybrid profile */

export interface IdToken {

    iss: string
    sub: string
    aud: string
    exp: number
    iat: number
    auth_time: number
    acr: string
    at_hash: string
    nonce: string
    Username: string
    aio: string
    oid: string
    c_hash: string
    agid: string
}

export interface Session {
    accessToken: string
    expireDurationSeconds: number
    idToken: string
    decodedIdToken: IdToken
}

export const awsProvider: IProvider<Session> = {
    buildAuthorizeUrl() {
        return `https://riverisland.auth.eu-west-1.amazoncognito.com/oauth2/authorize?response_type=token&client_id=1mt2mserndqu592t862g85dqb8&redirect_uri=${encodeURIComponent(`${window.location.origin}/redirect.html`)}&state=${guid()}&scope=openid+profile`
    },

    extractError(redirectUrl: string): Error | undefined {
        const errorMatch = redirectUrl.match(/error=([^&]+)/)
        if (!errorMatch) {
            return undefined
        }

        const errorReason = errorMatch[1]
        const errorDescriptionMatch = redirectUrl.match(/error_description=([^&]+)/)
        const errorDescription = errorDescriptionMatch ? errorDescriptionMatch[1] : ''
        return new Error(`Error during login. Reason: ${errorReason} Description: ${errorDescription}`)
    },

    extractSession(redirectUrl: string): Session {
        let accessToken: string = null!
        const accessTokenMatch = redirectUrl.match(/access_token=([^&]+)/)
        if (accessTokenMatch) {
            accessToken = accessTokenMatch[1]
        }

        let idToken: string = null!
        let decodedIdToken: IdToken = null!
        const idTokenMatch = redirectUrl.match(/id_token=([^&]+)/)
        if (idTokenMatch) {
            idToken = idTokenMatch[1]
            decodedIdToken = JSON.parse(atob(idToken.split('.')[1]))
        }

        let expireDurationSeconds: number = 3600
        const expireDurationSecondsMatch = redirectUrl.match(/expires_in=([^&]+)/)
        if (expireDurationSecondsMatch) {
            expireDurationSeconds = parseInt(expireDurationSecondsMatch[1])
        }

        return {
            accessToken,
            expireDurationSeconds,
            idToken,
            decodedIdToken
        }
    },

    validateSession(session: Session): boolean {
        const now = (new Date()).getTime() / 1000
        
        // With normal JWT tokens you can inspect the `exp` Expiration claim; however,
        // AAD V2 tokens are opaque and we must use the token meta about expiration time
        // "When you request an access token from the v2.0 endpoint, the v2.0 endpoint also returns metadata about the access token for your app to use."
        // See: https://docs.microsoft.com/en-us/azure/active-directory/develop/active-directory-v2-tokens
        // Here we are leveraging the fact that the access token was issued at the same
        // time as the ID token and can use its `iat` Issued At claim + the duration
        // to compute an absolute expiration time
        const expiration = 99999999//session.decodedIdToken.iat + session.expireDurationSeconds

        // 15 minutes minimum duration until token expires
        const minimumDuration = 60 * 15
        return (expiration - now) > minimumDuration
    },

    getAccessToken(session: Session, resourceId: string): string {
        return session.accessToken
    },

    getSignOutUrl(redirectUrl: string): string {
        return `https://riverisland.auth.eu-west-1.amazoncognito.com/oauth2/logout?client_id=1mt2mserndqu592t862g85dqb8&logout_uri=${encodeURIComponent(redirectUrl)}`
    }
}