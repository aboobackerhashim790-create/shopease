import googleAuthLibrary from "google-auth-library";
const { OAuth2Client } = googleAuthLibrary;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default googleClient;
