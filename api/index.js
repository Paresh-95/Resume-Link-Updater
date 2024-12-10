import express from "express";
import { join, dirname } from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import multer from "multer";
import fs from "fs";
import open from "open";

dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/drive'];


const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uris = [process.env.REDIRECT_URI];

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const TOKEN_PASS = 'token.json';
if (fs.existsSync(TOKEN_PASS)) {
  const token = JSON.parse(fs.readFileSync(TOKEN_PASS, 'utf-8'));
  oAuth2Client.setCredentials(token);
}

const app = express();
const PORT = 3000;

const upload = multer({ dest: "uploads/" });

let fileId = "1DMt126PmCVO3UIQOStbauEHSaK0GFJT9"; // Initial file ID

async function updateFile(filePath) {
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  const media = {
    mimeType: 'application/pdf',
    body: fs.createReadStream(filePath),
  };

  try {
    const response = await drive.files.update({
      fileId,
      media,
    });
    console.log('File updated successfully:', response.data);
    return `https://drive.google.com/file/d/${fileId}/view`;
  } catch (error) {
    console.error('Error updating file:', error);
    throw error;
  }
}

app.use(express.static("public"));

app.post("/upload", upload.single("resume"), async (req, res) => {
  const filePath = req.file.path;

  try {
    const link = await updateFile(filePath);
    fs.unlinkSync(filePath); // Delete the uploaded file after uploading to Google Drive
    res.json({ message: "Resume updated successfully", link });
  } catch (error) {
    res.status(500).json({ error: "Failed to update resume" });
  }
});

let latestResumeLink = "https://drive.google.com/file/d/1rBpN6U1Djg2Tf9uD34sD8zftDO8ND1S_/view?usp=sharing"; // Initial link

const password = process.env.PASSWORD;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.set("view engine", "ejs");
app.set("views", join(__dirname, "../views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/auth", (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log(authUrl)
  open(authUrl);
  res.send("Authorization in progress. Please complete the process in your browser.");
});

app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send("Authorization code not found.");
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PASS, JSON.stringify(tokens));
    res.redirect("/fileUpdate");
  } catch (error) {
    console.error("Error retrieving access token", error);
    res.status(500).send("Error during OAuth process.");
  }
});

app.get("/", (req, res) => {
  res.render("index", { latestResumeLink, message: '' });
});

app.get("/fileUpdate", (req, res) => {
  if (!fs.existsSync(TOKEN_PASS)) {
    return res.redirect("/auth");
  }
  res.render("update", { message: '' });
});

app.get("/resume", (req, res) => {
  res.redirect(latestResumeLink);
});

app.post("/update-resume", (req, res) => {
  const { newLink, passwordInput } = req.body;

  if (passwordInput !== password) {
    console.log("Password Incorrect");
    return res.status(403).send("Forbidden: Incorrect password.");
  }

  if (newLink && typeof newLink === "string") {
    latestResumeLink = newLink;
    res.render("index", { latestResumeLink, message: "Resume link updated successfully!" });
  } else {
    res.status(400).send("Invalid link provided.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running successfully on http://localhost:${PORT}`);
});
