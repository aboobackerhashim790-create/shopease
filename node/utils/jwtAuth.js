import jwt from "jsonwebtoken";

const TOKEN_COOKIE = "shopease.token";
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24;
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: TOKEN_LIFETIME_SECONDS * 1000,
};

function issueAuthToken(res, userId) {
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: "HS256",
    subject: userId.toString(),
    expiresIn: TOKEN_LIFETIME_SECONDS,
  });
  res.cookie(TOKEN_COOKIE, token, cookieOptions);
}

function clearAuthToken(res) {
  const clearOptions = { ...cookieOptions };
  delete clearOptions.maxAge;
  res.clearCookie(TOKEN_COOKIE, clearOptions);
}

function verifyAuthToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
}

export { TOKEN_COOKIE, issueAuthToken, clearAuthToken, verifyAuthToken };
